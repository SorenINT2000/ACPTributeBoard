import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar as BootstrapNavbar, Nav, Container, NavbarText, Button } from 'react-bootstrap';
import { SunFill, MoonStarsFill, CircleHalf } from 'react-bootstrap-icons';
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
    const lastScrollY = useRef(0);

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
        <BootstrapNavbar expand="lg" className={`border-bottom navbar-sticky${hidden ? ' navbar-hidden' : ''}`}>
            <Container>
                <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" className="order-0" />
                <BootstrapNavbar.Brand as={Link} to="/" className="order-1">
                    ACP Tribute Board
                </BootstrapNavbar.Brand>
                <BootstrapNavbar.Collapse id="basic-navbar-nav" className="order-2">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/">
                            Home
                        </Nav.Link>
                        {currentUser && (
                            <>
                                <Nav.Link as={Link} to="/feed">
                                    Feed
                                </Nav.Link>
                                <Nav.Link as={Link} to="/exhibit">
                                    Exhibit
                                </Nav.Link>
                                {isHighLevel && (
                                    <Nav.Link as={Link} to="/admin">
                                        Admin
                                    </Nav.Link>
                                )}
                            </>
                        )}
                    </Nav>
                    <Nav className="align-items-center">
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
                        {currentUser ? (
                            <>
                                <NavbarText className="me-3 d-flex align-items-center gap-2">
                                    {isHighLevel && (
                                        <span
                                            className="badge rounded-pill"
                                            style={{ backgroundColor: '#6f42c1', fontSize: '0.7rem' }}
                                            title="High-level user"
                                        >
                                            Staff
                                        </span>
                                    )}
                                    {currentUser.email}
                                </NavbarText>
                                <Nav.Link onClick={handleSignOut}>
                                    Sign Out
                                </Nav.Link>
                            </>
                        ) : (
                            <Nav.Link as={Link} to="/login">
                                Log In
                            </Nav.Link>
                        )}
                    </Nav>
                </BootstrapNavbar.Collapse>
            </Container>
        </BootstrapNavbar>
    );
}

export default Navbar;
