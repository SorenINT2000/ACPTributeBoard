import { Navigate } from 'react-router-dom';
import { Spinner, Container } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { currentUser, loading, isHighLevel } = useAuth();

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    if (!isHighLevel) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

export default AdminRoute;
