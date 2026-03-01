import { useEffect, useState } from 'react';
import { Button, Carousel } from 'react-bootstrap';
import { Trash, PencilSquare } from 'react-bootstrap-icons';
import { getExhibitImages } from '../utils/exhibitImages';
import MasonryGrid from './MasonryGrid';
import PostCard from './PostCard';
import Artifact, { type Artifact as ArtifactType } from './Artifact';
import type { Post } from './PostCard';

export interface ExhibitConfig {
    id: string;
    exhibitNumber: number;
    title: string;
    subtitle: string;
    backgroundImage: string;
    quote?: string;
    quoteAuthor?: string;
}

export interface ParallaxExhibitProps {
    exhibit: ExhibitConfig;
    posts: Post[];
    artifacts: ArtifactType[];
    isAuthenticated: boolean;
    isHighLevel: boolean;
    reloadKey: number;
    onViewPost: (postId: string) => void;
    onEditPost: (postId: string) => void;
    onAddArtifact: (exhibitNumber: number) => void;
    onDeleteArtifact: (artifact: ArtifactType) => void;
    onEditCarousel: (exhibitNumber: number) => void;
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
    reloadKey,
    onViewPost,
    onEditPost,
    onAddArtifact,
    onDeleteArtifact,
    onEditCarousel,
}: ParallaxExhibitProps) => {
    const [carouselImages, setCarouselImages] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        getExhibitImages(exhibit.exhibitNumber).then(urls => {
            if (!cancelled) setCarouselImages(urls);
        }).catch(err => {
            console.error(`Failed to load carousel images for exhibit ${exhibit.exhibitNumber}:`, err);
        });
        return () => { cancelled = true; };
    }, [exhibit.exhibitNumber, reloadKey]);

    const bgImages = carouselImages.length > 0 ? carouselImages : [exhibit.backgroundImage];

    const masonryItems = posts.map(post => ({
        ...post,
        contentLength: post.content.length,
    }));

    return (
        <div className="parallax-chapter">
            {/* THE PARALLAX HEADER */}
            <div className="parallax-header">
                <div className="parallax-dimmer" />
                {isHighLevel && (
                    <button
                        type="button"
                        className="carousel-edit-btn"
                        onClick={() => onEditCarousel(exhibit.exhibitNumber)}
                        aria-label="Edit carousel images"
                    >
                        <PencilSquare size={18} />
                    </button>
                )}
                {bgImages.length === 1 ? (
                    <img
                        src={bgImages[0]}
                        className="parallax-bg-image"
                        alt={exhibit.title}
                    />
                ) : (
                    <Carousel
                        fade
                        controls={false}
                        indicators={false}
                        interval={8000}
                        pause={false}
                        className="parallax-carousel"
                    >
                        {bgImages.map((url, i) => (
                            <Carousel.Item key={i}>
                                <img
                                    src={url}
                                    className="parallax-bg-image"
                                    alt={`${exhibit.title} – ${i + 1}`}
                                />
                            </Carousel.Item>
                        ))}
                    </Carousel>
                )}
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

export default ParallaxExhibit;
