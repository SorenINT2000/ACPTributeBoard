import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePostEditor } from '../hooks/usePostEditor';
import { subscribeToAllPosts, deletePost as deletePostDocument } from '../hooks/postService';
import { subscribeToArtifacts, deleteArtifact } from '../hooks/artifactService';
import { parseGalleryContent } from '../utils/artifactUtils';
import { deleteStorageFilesByUrls } from '../utils/imageUpload';
import PostEditorModal from '../components/PostEditorModal';
import PostViewModal from '../components/PostViewModal';
import ArtifactEditorModal from '../components/ArtifactEditorModal';
import CarouselEditorModal from '../components/CarouselEditorModal';
import ParallaxExhibit, { type ExhibitConfig } from '../components/ParallaxExhibit';
import { type Artifact as ArtifactType } from '../components/Artifact';
import type { Post } from '../components/PostCard';

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
        title: 'College Alignment, Sustainability, and Success',
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
        title: 'Membership Engagement and Creating a Professional Home',
        subtitle: '',
        backgroundImage: '/exhibits/bg-professional-home.webp',
        quote: '"Diversity is being invited to the party; Inclusion is being asked to dance."',
        quoteAuthor: '— Verna Myers',
    },
    {
        id: 'exhibit-6',
        exhibitNumber: 6,
        title: 'About That Time There Was A Pandemic',
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
        title: 'Legacy and Impact',
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

// --- Main Component ---

export default function Exhibit() {
    const { currentUser, isHighLevel } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [artifacts, setArtifacts] = useState<ArtifactType[]>([]);
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const [viewPostId, setViewPostId] = useState<string | null>(null);
    // Artifact editor state (create only; no edit)
    const [artifactEditorExhibitId, setArtifactEditorExhibitId] = useState<number | null>(null);
    // Carousel editor state
    const [carouselEditorExhibitNumber, setCarouselEditorExhibitNumber] = useState<number | null>(null);
    const [carouselReloadKey, setCarouselReloadKey] = useState(0);

    const handleCloseEditor = () => {
        setActivePostId(null);
    };

    const handlePostSaved = (detail: { postId: string; content: string }) => {
        const now = Date.now();
        setPosts(prev =>
            prev.map(p =>
                p.id === detail.postId ? { ...p, content: detail.content, updatedAt: now } : p,
            ),
        );
        handleCloseEditor();
    };

    const { editor, isReady, isDirty, isSaving, save } = usePostEditor({
        postId: activePostId,
        userId: currentUser?.uid ?? null,
        onSaved: handlePostSaved,
    });

    useEffect(() => {
        const unsubscribe = subscribeToAllPosts((postsArray) => {
            setPosts(postsArray);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeToArtifacts((artifactsArray) => {
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

    const handleDeletePost = async (postId: string) => {
        try {
            await deletePostDocument(postId);
            setActivePostId(current => (current === postId ? null : current));
            setViewPostId(current => (current === postId ? null : current));
        } catch (error) {
            console.error('Failed to delete post:', error);
        }
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

    const handleEditCarousel = (exhibitNumber: number) => {
        setCarouselEditorExhibitNumber(exhibitNumber);
    };

    const handleCarouselSaved = () => {
        setCarouselReloadKey(k => k + 1);
    };

    const handleCloseCarouselEditor = () => {
        setCarouselEditorExhibitNumber(null);
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
            await deleteArtifact(artifact.id);
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
                    <h1 className="exhibit-title-eyebrow">CELEBRATING A DECADE OF</h1>
                    <h1 className="exhibit-title">INSPIRING LEADERSHIP</h1>
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
                    reloadKey={carouselReloadKey}
                    onViewPost={handleViewPost}
                    onEditPost={handleEditPost}
                    onDeletePost={handleDeletePost}
                    onAddArtifact={handleAddArtifact}
                    onDeleteArtifact={handleDeleteArtifact}
                    onEditCarousel={handleEditCarousel}
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

            <section className="exhibit-legacy-cta" aria-labelledby="exhibit-legacy-cta-heading">
                <div className="exhibit-legacy-cta-inner">
                    <img
                        src="/carry-the-legacy-forward.png"
                        alt="Carry the legacy forward — support emerging leaders in accessible conference travel"
                        className="exhibit-legacy-cta-image"
                        loading="lazy"
                        decoding="async"
                    />
                    <h2 id="exhibit-legacy-cta-heading" className="exhibit-legacy-cta-heading">
                        Carry Dr. Moyer's legacy forward!
                    </h2>
                    <p className="exhibit-legacy-cta-lead mb-4">
                        Empower the next generation of leaders by contributing to the<br/>
                        <strong>Emerging Leaders Internal Medicine Meeting Travel Award:</strong>
                    </p>

                    <a
                        className="btn btn-primary"
                        href="https://secure.givelively.org/donate/american-college-of-physicians-inc/the-emerging-leaders-internal-medicine-meeting-travel-award"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Donate Now
                    </a>
                </div>
            </section>

            {/* Modals */}
            <PostEditorModal
                show={activePostId !== null}
                activePost={activePost || null}
                editor={editor}
                isReady={isReady}
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={save}
                onClose={handleCloseEditor}
                saveDisabled={isSaving || !isDirty}
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

            {/* Carousel Editor Modal */}
            {carouselEditorExhibitNumber !== null && (
                <CarouselEditorModal
                    show
                    exhibitNumber={carouselEditorExhibitNumber}
                    onClose={handleCloseCarouselEditor}
                    onSaved={handleCarouselSaved}
                />
            )}
        </div>
    );
}
