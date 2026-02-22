import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getUserProfile, createUserProfile } from '../utils/userProfile';

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isResetPassword, setIsResetPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleGoogleSignIn = async () => {
        setError(null);
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const existingProfile = await getUserProfile(user.uid);
            if (!existingProfile) {
                const nameParts = (user.displayName || '').split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                await createUserProfile(user.uid, user.email || '', firstName, lastName);
            }

            navigate('/');
        } catch (err: unknown) {
            console.error(err);
            const errorCode = (err as { code?: string })?.code;
            if (errorCode === 'auth/popup-closed-by-user') {
                setError('Google sign-in was cancelled. Please try again.');
            } else {
                const errorMessage = (err as { message?: string })?.message;
                setError(errorMessage || 'Google sign-in failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isResetPassword) {
                await sendPasswordResetEmail(auth, email);
                setResetSent(true);
                setError(null);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                navigate('/');
            }
        } catch (err: unknown) {
            const errorCode = (err as { code?: string })?.code;
            const errorMessage = (err as { message?: string })?.message;

            switch (errorCode) {
                case 'auth/user-not-found':
                    setError('No account found with this email.');
                    break;
                case 'auth/wrong-password':
                    setError('Incorrect password. Please try again.');
                    break;
                case 'auth/invalid-email':
                    setError('Invalid email address.');
                    break;
                case 'auth/too-many-requests':
                    setError('Too many failed attempts. Please try again later.');
                    break;
                case 'auth/user-disabled':
                    setError('This account has been disabled.');
                    break;
                case 'auth/network-request-failed':
                    setError('Network error. Please check your connection.');
                    break;
                default:
                    setError(errorMessage || 'An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (resetSent) {
        return (
            <Container className="mt-5">
                <Card className="mx-auto" style={{ maxWidth: '400px' }}>
                    <Card.Body>
                        <Card.Title>Sign In</Card.Title>
                        <Alert variant="success" className="text-center">
                            Password reset email sent! Check your inbox.
                        </Alert>
                        <div className="d-grid">
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setIsResetPassword(false);
                                    setResetSent(false);
                                    setEmail('');
                                }}
                            >
                                Back to Sign In
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            </Container>
        );
    }

    return (
        <Container className="mt-5">
            <Card className="mx-auto" style={{ maxWidth: '400px' }}>
                <Card.Body>
                    <Card.Title>Sign In</Card.Title>
                    <Card.Text>Please sign in to access the ACP Tribute Board</Card.Text>
                    <div className="d-grid mb-3">
                        <Button
                            variant="outline-secondary"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="d-flex align-items-center justify-content-center gap-2"
                        >
                            <svg width="18" height="18" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                            </svg>
                            {loading ? 'Please wait...' : 'Sign in with Google'}
                        </Button>
                    </div>

                    <div className="d-flex align-items-center mb-3">
                        <hr className="flex-grow-1" />
                        <span className="px-2 text-muted" style={{ fontSize: '0.85rem' }}>or sign in with email</span>
                        <hr className="flex-grow-1" />
                    </div>

                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3" controlId="email">
                            <Form.Label>Email</Form.Label>
                            <Form.Control
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </Form.Group>

                        {!isResetPassword && (
                            <Form.Group className="mb-3" controlId="password">
                                <Form.Label>Password</Form.Label>
                                <Form.Control
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                                <Button
                                    variant="link"
                                    className="p-0 mt-1"
                                    onClick={() => setIsResetPassword(true)}
                                    style={{ fontSize: '0.9rem' }}
                                >
                                    Forgot password?
                                </Button>
                            </Form.Group>
                        )}

                        {error && (
                            <Alert variant="danger" className="mb-3">
                                {error}
                            </Alert>
                        )}

                        <div className="d-grid mb-3">
                            <Button
                                variant="primary"
                                type="submit"
                                disabled={loading}
                            >
                                {loading
                                    ? 'Please wait...'
                                    : isResetPassword
                                        ? 'Send Reset Email'
                                        : 'Sign In'}
                            </Button>
                        </div>

                        {isResetPassword && (
                            <div className="text-center">
                                <Button
                                    variant="link"
                                    className="p-0"
                                    onClick={() => {
                                        setIsResetPassword(false);
                                        setError(null);
                                    }}
                                >
                                    Back to sign in
                                </Button>
                            </div>
                        )}
                        {!isResetPassword && (
                            <div className="text-center">
                                <Link to="/signup" style={{ fontSize: '0.9rem' }}>
                                    Don't have an account? Sign up
                                </Link>
                            </div>
                        )}
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
}

export default Login;
