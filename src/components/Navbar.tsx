import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar as BootstrapNavbar, Nav, Container } from 'react-bootstrap';
import { BoxArrowRight, PersonCircle } from 'react-bootstrap-icons';
import { useAuth } from '../hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const SCROLL_THRESHOLD = 8;

function Navbar() {
    const { currentUser, isHighLevel } = useAuth();
    const navigate = useNavigate();
    const [hidden, setHidden] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const lastScrollY = useRef(0);

    const closeDrawer = useCallback(() => setExpanded(false), []);

    const handleScroll = useCallback(() => {
        const y = window.scrollY;
        if (Math.abs(y - lastScrollY.current) < SCROLL_THRESHOLD) return;
        setHidden(y > lastScrollY.current && y > 60);
        lastScrollY.current = y;
    }, []);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <BootstrapNavbar
            expand="lg"
            expanded={expanded}
            onToggle={setExpanded}
            className={`border-bottom navbar-sticky${hidden && !expanded ? ' navbar-hidden' : ''}`}
        >
            <Container>
                <BootstrapNavbar.Toggle aria-controls="main-navbar-nav" className="order-0" />
                <BootstrapNavbar.Brand as={Link} to="/" className="order-1">
                    Dr. Moyer's Tribute Board
                </BootstrapNavbar.Brand>

                <BootstrapNavbar.Collapse id="main-navbar-nav" className="order-2 order-lg-2">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/" onClick={closeDrawer}>Feed</Nav.Link>
                        {currentUser && (
                            <>
                                <Nav.Link as={Link} to="/exhibit" onClick={closeDrawer}>Exhibit</Nav.Link>
                                {isHighLevel && (
                                    <Nav.Link as={Link} to="/admin" onClick={closeDrawer}>Admin</Nav.Link>
                                )}
                            </>
                        )}
                    </Nav>

                    <hr className="d-lg-none my-2 border-top" />

                    <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center ms-lg-auto navbar-user-and-credit">
                        <Nav className="order-1 order-lg-2 align-items-lg-center navbar-user-section">
                            {currentUser ? (
                                <>
                                    <div className="d-flex align-items-center gap-2 px-3 py-2 px-lg-0 py-lg-0 me-lg-3 navbar-user-info">
                                        <PersonCircle size={18} className="text-muted d-lg-none" />
                                        {isHighLevel && (
                                            <span
                                                className="badge rounded-pill"
                                                style={{ backgroundColor: '#6f42c1', fontSize: '0.7rem' }}
                                                title="High-level user"
                                            >
                                                Staff
                                            </span>
                                        )}
                                        <span className="text-truncate" style={{ maxWidth: '200px' }}>
                                            {currentUser.email}
                                        </span>
                                    </div>
                                    <Nav.Link
                                        onClick={() => { closeDrawer(); handleSignOut(); }}
                                        className="d-flex align-items-center gap-2"
                                    >
                                        <BoxArrowRight size={16} className="d-lg-none" />
                                        Sign Out
                                    </Nav.Link>
                                </>
                            ) : (
                                <Nav.Link as={Link} to="/login" onClick={closeDrawer}>Log In</Nav.Link>
                            )}
                        </Nav>
                        <div className="navbar-credit-wrap order-2 order-lg-1 align-self-end align-self-lg-center text-end text-lg-start px-3 px-lg-0">
                            <Nav.Link
                                href="https://sorenschultz.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="navbar-credit-link py-2 py-lg-1"
                                onClick={closeDrawer}
                            >
                                Website by Soren Schultz
                            </Nav.Link>
                        </div>
                    </div>
                </BootstrapNavbar.Collapse>
            </Container>
        </BootstrapNavbar>
    );
}

export default Navbar;
