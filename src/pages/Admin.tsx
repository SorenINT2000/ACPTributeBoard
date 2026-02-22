import { useEffect, useState } from 'react';
import { Container, Card, Table, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from '../firebaseConfig';
import type { UserProfile } from '../utils/userProfile';

const assignHighLevel = httpsCallable<{ uid: string }, { success: boolean }>(functions, 'assignHighLevel');

function Admin() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [promoting, setPromoting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(firestore, 'users'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const profiles = snapshot.docs.map((doc) => doc.data() as UserProfile);
            setUsers(profiles);
            setLoading(false);
        }, (err) => {
            setError(err.message);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const handlePromote = async (uid: string, displayName: string) => {
        setError(null);
        setSuccess(null);
        setPromoting(uid);
        try {
            await assignHighLevel({ uid });
            setSuccess(`${displayName} has been promoted to Staff.`);
        } catch (err: unknown) {
            const msg = (err as { message?: string })?.message || 'Failed to promote user.';
            setError(msg);
        } finally {
            setPromoting(null);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    };

    return (
        <Container className="mt-4 mb-5">
            <h2 className="mb-4">Admin Dashboard</h2>

            {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <strong>Users</strong>
                    <Badge bg="secondary">{users.length}</Badge>
                </Card.Header>
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="d-flex justify-content-center p-4">
                            <Spinner animation="border" size="sm" />
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-muted p-3 mb-0">No users found.</p>
                    ) : (
                        <div className="table-responsive">
                            <Table className="mb-0 align-middle">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Joined</th>
                                        <th>Role</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.uid}>
                                            <td>{user.firstName} {user.lastName}</td>
                                            <td>{user.email}</td>
                                            <td>{formatDate(user.createdAt)}</td>
                                            <td>
                                                {user.role === 'staff' ? (
                                                    <Badge style={{ backgroundColor: '#6f42c1' }}>Staff</Badge>
                                                ) : (
                                                    <span className="text-muted">Member</span>
                                                )}
                                            </td>
                                            <td className="text-end">
                                                {user.role !== 'staff' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline-primary"
                                                        disabled={promoting === user.uid}
                                                        onClick={() => handlePromote(user.uid, `${user.firstName} ${user.lastName}`)}
                                                    >
                                                        {promoting === user.uid ? (
                                                            <Spinner animation="border" size="sm" />
                                                        ) : (
                                                            'Promote to Staff'
                                                        )}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default Admin;
