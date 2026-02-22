import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar as BootstrapNavbar, Nav, Container, Button } from 'react-bootstrap';
import { SunFill, MoonStarsFill, CircleHalf, BoxArrowRight, PersonCircle } from 'react-bootstrap-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'auto'];
const THEME_ICON = { light: SunFill, dark: MoonStarsFill, auto: CircleHalf } as const;
const THEME_LABEL = { light: 'Light', dark: 'Dark', auto: 'Auto' } as const;

const SCROLL_THRESHOLD = 8;

function Navbar() {
    const { currentUser, isHighLevel } = useAuth();
    const { theme, setTheme } = useTheme();
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

    const cycleTheme = () => {
        const idx = THEME_CYCLE.indexOf(theme);
        setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
    };

    const ThemeIcon = THEME_ICON[theme];

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
                    ACP Tribute Board
                </BootstrapNavbar.Brand>

                {/* Always-visible controls beside the brand (mobile + desktop) */}
                <div className="d-flex align-items-center gap-2 order-2 order-lg-3 ms-auto ms-lg-0">
                    <Button
                        variant="link"
                        className="nav-link d-flex align-items-center gap-1 px-2"
                        onClick={cycleTheme}
                        title={`Theme: ${THEME_LABEL[theme]}`}
                        aria-label={`Switch theme (current: ${THEME_LABEL[theme]})`}
                    >
                        <ThemeIcon size={16} />
                        <span className="d-none d-lg-inline" style={{ fontSize: '0.8rem' }}>{THEME_LABEL[theme]}</span>
                    </Button>
                </div>

                <BootstrapNavbar.Collapse id="main-navbar-nav" className="order-3 order-lg-2">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/" onClick={closeDrawer}>Home</Nav.Link>
                        {currentUser && (
                            <>
                                <Nav.Link as={Link} to="/feed" onClick={closeDrawer}>Feed</Nav.Link>
                                <Nav.Link as={Link} to="/exhibit" onClick={closeDrawer}>Exhibit</Nav.Link>
                                {isHighLevel && (
                                    <Nav.Link as={Link} to="/admin" onClick={closeDrawer}>Admin</Nav.Link>
                                )}
                            </>
                        )}
                    </Nav>

                    <hr className="d-lg-none my-2 border-top" />

                    <Nav className="align-items-lg-center navbar-user-section">
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
                </BootstrapNavbar.Collapse>
            </Container>
        </BootstrapNavbar>
    );
}

export default Navbar;
