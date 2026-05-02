import { createContext, useEffect, useState, useContext } from "react";
import { app } from "../config/FirebaseConfig";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const AuthContext = createContext();

const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || import.meta.env.VITE_ADMIN_EMAIL || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const PROFILE_FETCH_TIMEOUT_MS = 6000;

const isConfiguredAdminEmail = (email = "") => adminEmails.includes(email.trim().toLowerCase());

const nowIso = () => new Date().toISOString();

const normalizeUserProfile = (uid, firebaseUser, profile = {}) => {
  const normalized = {
    uid,
    email: firebaseUser?.email || "",
    phone: "",
    role: "customer",
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...profile,
  };

  normalized.uid = uid;
  normalized.email = profile.email || firebaseUser?.email || "";
  normalized.phone = profile.phone || "";
  normalized.role = profile.role || normalized.role;
  normalized.status = profile.status || normalized.status;
  normalized.createdAt = profile.createdAt || normalized.createdAt;
  normalized.updatedAt = profile.updatedAt || normalized.updatedAt;

  return normalized;
};

const isBlockedStatus = (status) => status === "suspended" || status === "deleted";

const createOfflineFallbackProfile = (firebaseUser) =>
  normalizeUserProfile(firebaseUser.uid, firebaseUser, {
    role: isConfiguredAdminEmail(firebaseUser?.email || "") ? "admin" : "customer",
    status: "active",
  });

const isExpectedProfileFallbackError = (error) =>
  error?.code === "permission-denied" ||
  error?.message === "Timed out while loading user profile.";

const withTimeout = (promise, timeoutMs, timeoutMessage) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const mapFirebaseAuthError = (error) => {
  const code = error?.code;

  if (code === "auth/invalid-credential") {
    return "Invalid email or password.";
  }

  if (code === "auth/operation-not-allowed") {
    return "Email/password sign-in is disabled in Firebase. Enable it in Firebase Console > Authentication > Sign-in method.";
  }

  if (code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  if (code === "auth/email-already-in-use") {
    return "This email is already registered. Please sign in instead.";
  }

  if (code === "auth/weak-password") {
    return "Password is too weak. Use at least 6 characters.";
  }

  if (code === "auth/email-not-verified") {
    return "Please verify your email before signing in.";
  }

  return error?.message || "Authentication failed.";
};

export const AuthContextProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [authReady, setAuthReady] = useState(false);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const refreshUserSnapshot = async (firebaseUser) => {
    const profileRef = doc(db, "users", firebaseUser.uid);
    const profileSnapshot = await getDoc(profileRef);

    if (!profileSnapshot.exists()) {
      const adminQuery = query(collection(db, "users"), where("role", "==", "admin"));
      const adminSnapshot = await getDocs(adminQuery);
      const shouldBootstrapAdmin = adminEmails.includes((firebaseUser.email || "").toLowerCase()) || adminSnapshot.empty;
      const profile = normalizeUserProfile(firebaseUser.uid, firebaseUser, {
        email: firebaseUser.email || "",
        phone: "",
        role: shouldBootstrapAdmin ? "admin" : "customer",
        status: "active",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });

      await setDoc(profileRef, profile, { merge: true });
      return profile;
    }

    const existingProfile = normalizeUserProfile(firebaseUser.uid, firebaseUser, profileSnapshot.data());
    const updates = {};

    if (!existingProfile.email && firebaseUser.email) {
      updates.email = firebaseUser.email;
    }

    if (!existingProfile.createdAt) {
      updates.createdAt = nowIso();
    }

    if (!existingProfile.updatedAt) {
      updates.updatedAt = nowIso();
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(profileRef, updates);
      return normalizeUserProfile(firebaseUser.uid, firebaseUser, {
        ...existingProfile,
        ...updates,
      });
    }

    return existingProfile;
  };

  const loadCurrentUser = async (firebaseUser) => {
    let profile;

    try {
      profile = await withTimeout(
        refreshUserSnapshot(firebaseUser),
        PROFILE_FETCH_TIMEOUT_MS,
        "Timed out while loading user profile."
      );
    } catch (error) {
      if (isExpectedProfileFallbackError(error)) {
        console.info("Using fallback profile because Firestore profile sync is currently unavailable.");
      } else {
        console.error("Unable to load user profile from Firestore, using fallback profile:", error);
      }
      profile =
        userProfile?.uid === firebaseUser.uid ? userProfile : createOfflineFallbackProfile(firebaseUser);
    }

    if (isBlockedStatus(profile.status)) {
      await firebaseSignOut(auth);
      return { blocked: true, profile };
    }

    setSession(firebaseUser);
    setUserProfile(profile);
    return { blocked: false, profile };
  };

  const updateUserProfile = async (userId, updates) => {
    const profileRef = doc(db, "users", userId);
    const nextUpdates = {
      ...updates,
      updatedAt: nowIso(),
    };

    await updateDoc(profileRef, nextUpdates);
    setUsers((previousUsers) =>
      previousUsers.map((user) =>
        user.uid === userId ? normalizeUserProfile(userId, { email: user.email }, { ...user, ...nextUpdates }) : user
      )
    );

    if (session?.uid === userId) {
      setUserProfile((currentProfile) =>
        currentProfile ? normalizeUserProfile(userId, { email: currentProfile.email }, { ...currentProfile, ...nextUpdates }) : currentProfile
      );
    }

    if (session?.uid === userId && isBlockedStatus(nextUpdates.status)) {
      await firebaseSignOut(auth);
      setSession(null);
      setUserProfile(null);
    }

    return nextUpdates;
  };

  useEffect(() => {
    const canReadUsersCollection =
      Boolean(session?.uid) &&
      (userProfile?.role === "admin" || isConfiguredAdminEmail(session?.email || ""));

    if (!canReadUsersCollection) {
      setUsers([]);
      return undefined;
    }

    const usersCollection = collection(db, "users");

    const unsubscribe = onSnapshot(
      usersCollection,
      (snapshot) => {
        const nextUsers = snapshot.docs.map((userDoc) =>
          normalizeUserProfile(userDoc.id, { email: userDoc.data()?.email || "" }, userDoc.data())
        );

        setUsers(nextUsers);

        if (session?.uid) {
          const currentProfile = nextUsers.find((user) => user.uid === session.uid) || null;
          if (currentProfile) {
            setUserProfile(currentProfile);

            if (isBlockedStatus(currentProfile.status)) {
              void firebaseSignOut(auth).then(() => {
                setSession(null);
                setUserProfile(null);
              });
            }
          }
        }
      },
      (error) => {
        if (error?.code !== "permission-denied") {
          console.error("Error listening to users:", error);
        }
        setUsers([]);
      }
    );

    return () => unsubscribe();
  }, [db, session?.uid, session?.email, userProfile?.role]);

  //Sign Up
  const signUpNewUser = async (email, password, options = {}) => {
    try {
      const data = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(data.user);
      const shouldCreateAdminProfile = options?.role === "admin";

      const fallbackProfile = normalizeUserProfile(data.user.uid, data.user, {
        email: data.user.email || email,
        phone: "",
        role: shouldCreateAdminProfile ? "admin" : "customer",
        status: "active",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });

      setSession(data.user);
      setUserProfile(fallbackProfile);

      let profile = fallbackProfile;

      try {
        profile = shouldCreateAdminProfile ? fallbackProfile : await refreshUserSnapshot(data.user);

        if (!shouldCreateAdminProfile) {
          setUserProfile(profile);
        }

        if (shouldCreateAdminProfile) {
          await setDoc(doc(db, "users", data.user.uid), profile, { merge: true });
        }
      } catch (profileError) {
        if (profileError?.code !== "permission-denied") {
          throw profileError;
        }

        console.info("Unable to sync user profile to Firestore, continuing with local profile.");
        profile = fallbackProfile;
      }

      setUserProfile(profile);

      return {
        success: true,
        data,
        profile,
        requiresEmailVerification: false,
        message: "Account created successfully.",
      };
    } catch (error) {
      console.error("Error signing up:", error);
      return { success: false, error: mapFirebaseAuthError(error), code: error?.code };
    }

  };

  const resetUserPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: "Password reset email sent." };
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return { success: false, error: mapFirebaseAuthError(error), code: error?.code };
    }
  };

  //Sign In
  const signInUser = async (email, password) => {
    try {
      const data = await signInWithEmailAndPassword(auth, email, password);
      await reload(data.user);
      const result = await loadCurrentUser(data.user);

      if (result.blocked) {
        return {
          success: false,
          code: "auth/account-disabled",
          error:
            result.profile.status === "suspended"
              ? "This account is suspended. Contact an administrator."
              : "This account has been deleted. Contact an administrator.",
        };
      }

      console.log("sign-in success", data);
      return { success: true, data, profile: result.profile };
    } catch (error) {
      console.error("Error signing in:", error);
      return { success: false, error: mapFirebaseAuthError(error), code: error?.code };
    }
  };

  const checkEmailVerification = async () => {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        return { success: false, verified: false, error: "No active user session." };
      }

      await reload(currentUser);

      if (currentUser.emailVerified) {
        const result = await loadCurrentUser(currentUser);

        if (result.blocked) {
          return { success: false, verified: false, error: "This account is blocked.", code: "auth/account-disabled" };
        }

        return { success: true, verified: true };
      }

      return { success: true, verified: false };
    } catch (error) {
      console.error("Error checking email verification:", error);
      return { success: false, verified: false, error: mapFirebaseAuthError(error), code: error?.code };
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setSession(null);
          setAuthReady(true);
          return;
        }

        try {
          await reload(user);
          const result = await loadCurrentUser(user);

          if (result.blocked) {
            setSession(null);
            setUserProfile(null);
          }
        } catch (error) {
          console.error("Error loading current user:", error);
          setSession(null);
          setUserProfile(null);
        } finally {
          setAuthReady(true);
        }
      },
      (error) => {
        console.error("Error getting auth state:", error);
        setSession(null);
        setUserProfile(null);
        setAuthReady(true);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  //Sign Out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setSession(null);
      setUserProfile(null);
      return { success: true };
    } catch (error) {
      console.error("Error signing out:", error);
      return { success: false, error: error.message || "Unable to sign out." };
    }
    
  };

  const suspendUser = async (userId) => updateUserProfile(userId, { status: "suspended" });
  const deleteUser = async (userId) => updateUserProfile(userId, { status: "deleted" });
  const restoreUser = async (userId) => updateUserProfile(userId, { status: "active" });
  const setUserRole = async (userId, role) => updateUserProfile(userId, { role });
  
  return (
    <AuthContext.Provider value={{
      session,
      userProfile,
      users,
      authReady,
      isAdmin:
        userProfile?.role === "admin" ||
        (userProfile == null && isConfiguredAdminEmail(session?.email || "")),
      isConfiguredAdminEmail,
      signUpNewUser,
      signInUser,
      checkEmailVerification,
      signOut,
      refreshUserSnapshot,
      resetUserPassword,
      suspendUser,
      deleteUser,
      restoreUser,
      setUserRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useUserAuth = () => {
  return useContext(AuthContext);
};

export const userAuth = useUserAuth;