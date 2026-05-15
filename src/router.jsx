import { createBrowserRouter } from "react-router-dom";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import { Home } from "./pages/Home";
import { Layout } from "./components/Layout";
import { Shop } from "./pages/Shop";
import { ProductDetail } from "./pages/Product";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { Tracking } from "./pages/Tracking";
import { Showcase } from "./pages/Showcase";
import PrivateRoute from "./pages/PrivateRoute";
import AdminRoute from "./pages/AdminRoute";
import Admin from "./pages/Admin";
import AdminSignIn from "./pages/AdminSignIn";
import AdminSignUp from "./pages/AdminSignUp";

export const router = createBrowserRouter([
  { path: "/signup", element: <SignUp /> },
  { path: "/signin", element: <SignIn /> },
  { path: "/admin/signin", element: <AdminSignIn /> },
  { path: "/admin/signup", element: <AdminSignUp /> },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <Admin />
      </AdminRoute>
    ),
  },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "/homepage", 
        element:(
          <PrivateRoute requireNonAdmin>
            <Home />
          </PrivateRoute>
        ),
      },
      { path: "/shop", element: <Shop /> },
      { path: "/showcase", element: <Showcase /> },
      { path: "/product/:id", element: <ProductDetail /> },
      { path: "/cart", element: <Cart /> },
      { path: "/checkout", element: <Checkout /> },
      { path: "/tracking", element: <Tracking /> },
    ],
    
  },
]);