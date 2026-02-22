import { useEffect, useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';
import { useAuth } from '../hooks/useAuth';
import { useYjs } from '../hooks/useYjs';
import { YjsRealtimeDatabaseProvider } from '../providers/YjsRealtimeDatabaseProvider';
import { parseGalleryContent } from '../utils/artifactUtils';
import { deleteStorageFilesByUrls } from '../utils/imageUpload';
import PostEditorModal from '../components/PostEditorModal';
import PostViewModal from '../components/PostViewModal';
import ArtifactEditorModal from '../components/ArtifactEditorModal';
import MasonryGrid from '../components/MasonryGrid';
import PostCard from '../components/PostCard';
import Artifact, { type Artifact as ArtifactType } from '../components/Artifact';
import type { Post } from '../components/PostCard';

// --- Types ---

interface ExhibitConfig {
    id: string;
    exhibitNumber: number;
    title: string;
    subtitle: string;
    backgroundImage: string;
    quote?: string;
    quoteAuthor?: string;
}

// --- Exhibit Definitions ---
// Static exhibit data - posts with matching `exhibit` field in the database will appear under that exhibit

const EXHIBITS: ExhibitConfig[] = [
    {
        id: 'exhibit-1',
        exhibitNumber: 1,
        title: 'Physician Well-being and Professional Fulfillment',
        subtitle: '',
        backgroundImage: '/exhibits/bg-wellbeing.webp',
        quote: '"For there is always light, if only we\'re brave enough to see it, if only we\'re brave enough to be it."',
        quoteAuthor: '— Amanda Gorman',
    },
    {
        id: 'exhibit-2',
        exhibitNumber: 2,
        title: 'Advocacy',
        subtitle: '',
        backgroundImage: '/exhibits/bg-advocacy.webp',
        quote: '"Don\'t agonize—organize."',
        quoteAuthor: '— Nancy Pelosi',
    },
    {
        id: 'exhibit-3',
        exhibitNumber: 3,
        title: 'Chapter Alignment, Sustainability, and Success',
        subtitle: '',
        backgroundImage: '/exhibits/chapter.webp',
        quote: '"If you want to go fast, go alone; if you want to go far, go together."',
        quoteAuthor: '— African Proverb',
    },
    {
        id: 'exhibit-4',
        exhibitNumber: 4,
        title: 'Medical Education and Evidence-based Medicine',
        subtitle: '',
        backgroundImage: '/exhibits/bg-med-ed.webp',
        quote: '"Medicine disregards international boundaries. The physician studies for the benefit of humankind."',
        quoteAuthor: '— George R. Minot',
    },
    {
        id: 'exhibit-5',
        exhibitNumber: 5,
        title: 'Creating a Professional Home',
        subtitle: '',
        backgroundImage: '/exhibits/bg-professional-home.webp',
        quote: '"Diversity is being invited to the party; Inclusion is being asked to dance."',
        quoteAuthor: '— Verna Myers',
    },
    {
        id: 'exhibit-6',
        exhibitNumber: 6,
        title: 'Navigating the Pandemic',
        subtitle: '',
        backgroundImage: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&q=80&w=1600',
        quote: '"This pandemic has magnified every existing inequality in our society."',
        quoteAuthor: '— Melinda Gates',
    },
    {
        id: 'exhibit-7',
        exhibitNumber: 7,
        title: 'Leadership Development',
        subtitle: '',
        backgroundImage: '/exhibits/bg-leaders.webp',
        quote: '"The best leaders don\'t just lead. They create environments where new leaders are created."',
        quoteAuthor: '— Ross Simmonds',
    },
    {
        id: 'exhibit-8',
        exhibitNumber: 8,
        title: 'Legacy',
        subtitle: '',
        backgroundImage: '/exhibits/bg-legacy.webp',
        quote: '"If you\'re going to live, leave a legacy. Make a mark on the world that can\'t be erased."',
        quoteAuthor: '— Maya Angelou',
    },
];

// --- Helper Functions ---

function getPostsForExhibit(posts: Post[], exhibit: ExhibitConfig): Post[] {
    // Only include posts that have an exhibit field matching this exhibit's number
    return posts.filter(post => post.exhibit === exhibit.exhibitNumber)
        .sort((a, b) => a.createdAt - b.createdAt);
}

function getArtifactsForExhibit(artifacts: ArtifactType[], exhibit: ExhibitConfig): ArtifactType[] {
    return artifacts.filter(artifact => artifact.exhibitId === exhibit.exhibitNumber)
        .sort((a, b) => a.createdAt - b.createdAt);
}

// --- Components ---

interface ParallaxExhibitProps {
    exhibit: ExhibitConfig;
    posts: Post[];
    artifacts: ArtifactType[];
    isAuthenticated: boolean;
    isHighLevel: boolean;
    onViewPost: (postId: string) => void;
    onEditPost: (postId: string) => void;
    onAddArtifact: (exhibitNumber: number) => void;
    onDeleteArtifact: (artifact: ArtifactType) => void;
}

/**
 * The Parallax Exhibit Divider
 * Uses sticky positioning to create a "reveal" effect as you scroll past.
 */
const ParallaxExhibit = ({
    exhibit,
    posts,
    artifacts,
    isAuthenticated: _isAuthenticated,
    isHighLevel,
    onViewPost,
    onEditPost,
    onAddArtifact,
    onDeleteArtifact,
}: ParallaxExhibitProps) => {
    // Transform posts for masonry grid
    const masonryItems = posts.map(post => ({
        ...post,
        contentLength: post.content.length,
    }));

    return (
        <div className="parallax-chapter">
            {/* THE PARALLAX HEADER */}
            <div className="parallax-header">
                <div className="parallax-dimmer" />
                <img
                    src={exhibit.backgroundImage}
                    className="parallax-bg-image"
                    alt={exhibit.title}
                />
                <div className="parallax-content">
                    <div className="parallax-content-left">
                        <h2 className="parallax-title">{exhibit.title}</h2>
                        {exhibit.subtitle && (
                            <p className="parallax-subtitle">{exhibit.subtitle}</p>
                        )}
                        {isHighLevel && (
                            <Button
                                variant="outline-light"
                                size="sm"
                                className="mt-3"
                                onClick={() => onAddArtifact(exhibit.exhibitNumber)}
                            >
                                + Add Artifact
                            </Button>
                        )}
                    </div>
                    {exhibit.quote && (
                        <div className="parallax-content-right">
                            <div className="parallax-quote">
                                <p className="parallax-quote-text">{exhibit.quote}</p>
                                {exhibit.quoteAuthor && (
                                    <p className="parallax-quote-author">{exhibit.quoteAuthor}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* THE CONTENT */}
            <div className="chapter-content">
                {/* First artifact at the top if available */}
                {artifacts[0] && (
                    <div className="chapter-artifact-container chapter-artifact-wrapper">
                        {isHighLevel && (
                            <button
                                type="button"
                                className="artifact-delete-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDeleteArtifact(artifacts[0]);
                                }}
                                aria-label="Delete artifact"
                            >
                                <Trash size={18} />
                            </button>
                        )}
                        <Artifact artifact={artifacts[0]} />
                    </div>
                )}

                {/* Regular posts in masonry layout */}
                {posts.length > 0 && (
                    <MasonryGrid
                        items={masonryItems}
                        className="chapter-masonry"
                        renderItem={(post, ref) => (
                            <PostCard
                                post={post}
                                onView={onViewPost}
                                onEdit={onEditPost}
                                cardRef={ref}
                            />
                        )}
                    />
                )}

                {/* Remaining artifacts */}
                {artifacts.slice(1).map(artifact => (
                    <div key={artifact.id} className="chapter-artifact-container chapter-artifact-wrapper">
                        {isHighLevel && (
                            <button
                                type="button"
                                className="artifact-delete-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDeleteArtifact(artifact);
                                }}
                                aria-label="Delete artifact"
                            >
                                <Trash size={18} />
                            </button>
                        )}
                        <Artifact artifact={artifact} />
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main Component ---

export default function Exhibit() {
    const { currentUser, isHighLevel } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [artifacts, setArtifacts] = useState<ArtifactType[]>([]);
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const [viewPostId, setViewPostId] = useState<string | null>(null);
    // Artifact editor state (create only; no edit)
    const [artifactEditorExhibitId, setArtifactEditorExhibitId] = useState<number | null>(null);

    // Use the Yjs hook for collaborative editing
    const { editor, isReady, deletePost, isEmpty } = useYjs({
        postId: activePostId,
        userId: currentUser?.uid ?? null,
        userName: currentUser?.email ?? null,
    });

    // Fetch posts from Firebase Realtime Database
    useEffect(() => {
        const unsubscribe = YjsRealtimeDatabaseProvider.subscribeToPosts((postsArray) => {
            setPosts(postsArray);
        });
        return unsubscribe;
    }, []);

    // Fetch artifacts from Firebase Realtime Database
    useEffect(() => {
        const unsubscribe = YjsRealtimeDatabaseProvider.subscribeToArtifacts((artifactsArray) => {
            setArtifacts(artifactsArray);
        });
        return unsubscribe;
    }, []);

    // Group posts and artifacts by exhibit
    const exhibitsWithContent = useMemo(() => {
        return EXHIBITS.map(exhibit => ({
            exhibit,
            posts: getPostsForExhibit(posts, exhibit),
            artifacts: getArtifactsForExhibit(artifacts, exhibit),
        }));
    }, [posts, artifacts]);

    // Handlers
    const handleEditPost = (postId: string) => {
        setActivePostId(postId);
    };

    const handleViewPost = (postId: string) => {
        setViewPostId(postId);
    };

    const handleCloseEditor = () => {
        if (activePostId && isEmpty()) {
            deletePost().catch(console.error);
        }
        setActivePostId(null);
    };

    const handleCloseView = () => {
        setViewPostId(null);
    };

    // Artifact editor handlers (create only)
    const handleAddArtifact = (exhibitNumber: number) => {
        setArtifactEditorExhibitId(exhibitNumber);
    };

    const handleCloseArtifactEditor = () => {
        setArtifactEditorExhibitId(null);
    };

    const handleDeleteArtifact = async (artifact: ArtifactType) => {
        if (!window.confirm('Delete this artifact? This cannot be undone.')) return;
        try {
            if (artifact.type === 'gallery') {
                const parsed = parseGalleryContent(artifact.content);
                if (parsed?.images?.length) {
                    const urls = parsed.images.map(img => img.url).filter(Boolean);
                    await deleteStorageFilesByUrls(urls);
                }
            }
            await YjsRealtimeDatabaseProvider.deleteArtifact(artifact.id);
        } catch (error) {
            console.error('Failed to delete artifact:', error);
        }
    };

    const activePost = activePostId ? posts.find(p => p.id === activePostId) : null;
    const viewPost = viewPostId ? posts.find(p => p.id === viewPostId) : null;

    // Calculate total posts and other stats (only count posts assigned to exhibits)
    const exhibitPosts = posts.filter(p => p.exhibit !== undefined);
    const totalPosts = exhibitPosts.length;
    const totalArtifacts = artifacts.length;
    const totalAuthors = new Set(exhibitPosts.map(p => p.authorId)).size;

    return (
        <div className="exhibit-page">
            {/* Intro Section */}
            <div className="exhibit-intro">
                <div className="exhibit-intro-content">
                    <h1 className="exhibit-title">A Decade of Leadership</h1>
                    <p className="exhibit-description">
                        Explore the exhibits below to relive the moments, the milestones, and the memories.
                    </p>
                    <div className="exhibit-stats">
                        <div className="exhibit-stat">
                            <span className="exhibit-stat-number">{totalPosts}</span>
                            <span className="exhibit-stat-label">Memories</span>
                        </div>
                        <div className="exhibit-stat">
                            <span className="exhibit-stat-number">{totalArtifacts}</span>
                            <span className="exhibit-stat-label">Artifacts</span>
                        </div>
                        <div className="exhibit-stat">
                            <span className="exhibit-stat-number">{totalAuthors}</span>
                            <span className="exhibit-stat-label">Contributors</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Exhibits */}
            {exhibitsWithContent.map(({ exhibit, posts: exhibitPostsList, artifacts: exhibitArtifacts }) => (
                <ParallaxExhibit
                    key={exhibit.id}
                    exhibit={exhibit}
                    posts={exhibitPostsList}
                    artifacts={exhibitArtifacts}
                    isAuthenticated={!!currentUser}
                    isHighLevel={isHighLevel}
                    onViewPost={handleViewPost}
                    onEditPost={handleEditPost}
                    onAddArtifact={handleAddArtifact}
                    onDeleteArtifact={handleDeleteArtifact}
                />
            ))}

            {/* Empty State */}
            {exhibitsWithContent.length === 0 && (
                <div className="exhibit-empty">
                    <p>No memories have been added yet.</p>
                    <p>Head to the Feed to add your first recognition post!</p>
                </div>
            )}

            {/* Outro */}
            <div className="exhibit-outro">
                <p className="exhibit-outro-text px-5 text-center">
                    <b>Thank you</b> for an incredible decade of trailblazing <b>leadership</b>, remarkable <b>impact</b>, and an unwavering <b>commitment</b> to advancing ACP's mission, culture, and growth!
                </p>
            </div>

            {/* Modals */}
            <PostEditorModal
                show={activePostId !== null}
                activePost={activePost || null}
                editor={editor}
                isReady={isReady}
                onClose={handleCloseEditor}
            />

            <PostViewModal
                show={viewPostId !== null}
                post={viewPost || null}
                onClose={handleCloseView}
            />

            {/* Artifact Editor Modal */}
            <ArtifactEditorModal
                show={artifactEditorExhibitId !== null}
                exhibitId={artifactEditorExhibitId}
                artifact={null}
                onClose={handleCloseArtifactEditor}
            />

        </div>
    );
}
