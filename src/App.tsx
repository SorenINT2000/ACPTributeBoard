import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Feed from './pages/Feed';
import Exhibit from './pages/Exhibit';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Admin from './pages/Admin';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                index: true,
                element: <Home />,
            },
            {
                path: 'login',
                element: <Login />,
            },
            {
                path: 'signup',
                element: <Signup />,
            },
            {
                path: 'feed',
                element: (
                    <ProtectedRoute>
                        <Feed />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'exhibit',
                element: (
                    <ProtectedRoute>
                        <Exhibit />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'admin',
                element: (
                    <AdminRoute>
                        <Admin />
                    </AdminRoute>
                ),
            },
        ],
    },
]);

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <RouterProvider router={router} />
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
