import { Link } from 'react-router-dom';
import { Container, Card, Button } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';

function Home() {
    const { currentUser } = useAuth();

    return (
        <Container className="mt-5">
            <Card className="text-center">
                <Card.Body>
                    <Card.Title as="h1">ACP Tribute Board</Card.Title>
                    <Card.Text>Welcome to the interactive tribute and recognition board</Card.Text>
                    {currentUser ? (
                        <div>
                            <Card.Text>Welcome back, {currentUser.email}!</Card.Text>
                            <Link to="/feed">
                                <Button variant="primary">Go to Feed</Button>
                            </Link>
                        </div>
                    ) : (
                        <div>
                            <Card.Text>Please sign in to access the recognition feed</Card.Text>
                            <div className="d-flex gap-2 justify-content-center mt-3">
                                <Link to="/login">
                                    <Button variant="primary">Sign In</Button>
                                </Link>
                                <Link to="/signup">
                                    <Button variant="outline-primary">Sign Up</Button>
                                </Link>
                            </div>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default Home;
