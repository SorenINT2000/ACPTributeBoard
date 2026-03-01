import { useRef } from 'react';
import { ButtonGroup, Button, Dropdown } from 'react-bootstrap';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import {
    TypeBold,
    TypeItalic,
    TypeUnderline,
    TypeStrikethrough,
    ListUl,
    ListOl,
    TextLeft,
    TextCenter,
    TextRight,
    Quote,
    CodeSlash,
    Image,
    EmojiSmile,
    CloudUpload,
    Link45deg,
} from 'react-bootstrap-icons';

// Popular emojis grouped by category
const emojiCategories = [
    {
        name: 'Smileys',
        emojis: [
            { emoji: '😀', shortcode: 'grinning' },
            { emoji: '😊', shortcode: 'blush' },
            { emoji: '😂', shortcode: 'joy' },
            { emoji: '🥹', shortcode: 'holding_back_tears' },
            { emoji: '😍', shortcode: 'heart_eyes' },
            { emoji: '🤩', shortcode: 'star_struck' },
            { emoji: '😎', shortcode: 'sunglasses' },
            { emoji: '🤔', shortcode: 'thinking' },
            { emoji: '🙏', shortcode: 'pray' },
            { emoji: '👍', shortcode: 'thumbsup' },
        ],
    },
    {
        name: 'Celebration',
        emojis: [
            { emoji: '🎉', shortcode: 'tada' },
            { emoji: '🎊', shortcode: 'confetti_ball' },
            { emoji: '🏆', shortcode: 'trophy' },
            { emoji: '🥇', shortcode: 'first_place_medal' },
            { emoji: '⭐', shortcode: 'star' },
            { emoji: '🌟', shortcode: 'star2' },
            { emoji: '✨', shortcode: 'sparkles' },
            { emoji: '💯', shortcode: '100' },
            { emoji: '🔥', shortcode: 'fire' },
            { emoji: '💪', shortcode: 'muscle' },
        ],
    },
    {
        name: 'Hearts',
        emojis: [
            { emoji: '❤️', shortcode: 'heart' },
            { emoji: '🧡', shortcode: 'orange_heart' },
            { emoji: '💛', shortcode: 'yellow_heart' },
            { emoji: '💚', shortcode: 'green_heart' },
            { emoji: '💙', shortcode: 'blue_heart' },
            { emoji: '💜', shortcode: 'purple_heart' },
            { emoji: '🤍', shortcode: 'white_heart' },
            { emoji: '💖', shortcode: 'sparkling_heart' },
            { emoji: '💕', shortcode: 'two_hearts' },
            { emoji: '💗', shortcode: 'heartpulse' },
        ],
    },
    {
        name: 'Gestures',
        emojis: [
            { emoji: '👏', shortcode: 'clap' },
            { emoji: '🙌', shortcode: 'raised_hands' },
            { emoji: '🤝', shortcode: 'handshake' },
            { emoji: '✋', shortcode: 'hand' },
            { emoji: '👋', shortcode: 'wave' },
            { emoji: '🤟', shortcode: 'love_you_gesture' },
            { emoji: '👊', shortcode: 'fist_oncoming' },
            { emoji: '✌️', shortcode: 'v' },
            { emoji: '🫶', shortcode: 'heart_hands' },
            { emoji: '👀', shortcode: 'eyes' },
        ],
    },
];

interface EditorToolbarProps {
    editor: Editor | null;
    onUploadImage?: (file: File) => Promise<void>;
}

function EditorToolbar({ editor, onUploadImage }: EditorToolbarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editorState = useEditorState({
        editor,
        selector: ({ editor: e }) => {
            if (!e) return null;
            return {
                isBold: e.isActive('bold'),
                isItalic: e.isActive('italic'),
                isUnderline: e.isActive('underline'),
                isStrike: e.isActive('strike'),
                isParagraph: e.isActive('paragraph') && !e.isActive('heading'),
                heading1: e.isActive('heading', { level: 1 }),
                heading2: e.isActive('heading', { level: 2 }),
                heading3: e.isActive('heading', { level: 3 }),
                alignLeft: e.isActive({ textAlign: 'left' }),
                alignCenter: e.isActive({ textAlign: 'center' }),
                alignRight: e.isActive({ textAlign: 'right' }),
                isBulletList: e.isActive('bulletList'),
                isOrderedList: e.isActive('orderedList'),
                isBlockquote: e.isActive('blockquote'),
                isCodeBlock: e.isActive('codeBlock'),
            };
        },
    });

    if (!editor || !editorState) return null;

    const headingOptions = [
        { level: 1, label: 'Heading 1', active: editorState.heading1 },
        { level: 2, label: 'Heading 2', active: editorState.heading2 },
        { level: 3, label: 'Heading 3', active: editorState.heading3 },
    ] as const;

    const currentHeading = headingOptions.find(h => h.active);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (onUploadImage) {
            await onUploadImage(file);
        }

        // Reset the input so the same file can be selected again
        e.target.value = '';
    };

    const handleEmbedUrl = () => {
        const url = window.prompt('Enter image URL:');
        if (url && url.trim()) {
            editor.chain().focus().setImage({ src: url.trim() }).run();
        }
    };

    return (
        <div className="editor-toolbar">
            {/* Text Style Group */}
            <ButtonGroup size="sm" className="me-2">
                <Dropdown>
                    <Dropdown.Toggle
                        variant="outline-secondary"
                        size="sm"
                        className="toolbar-dropdown"
                    >
                        {currentHeading?.label || 'Paragraph'}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item
                            onClick={() => editor.chain().focus().setParagraph().run()}
                            active={editorState.isParagraph}
                        >
                            Paragraph
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        {headingOptions.map(({ level, label, active }) => (
                            <Dropdown.Item
                                key={level}
                                onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
                                active={active}
                            >
                                {label}
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown>
            </ButtonGroup>

            {/* Text Formatting Group */}
            <ButtonGroup size="sm" className="me-2">
                <Button
                    variant={editorState.isBold ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Bold (Ctrl+B)"
                >
                    <TypeBold />
                </Button>
                <Button
                    variant={editorState.isItalic ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italic (Ctrl+I)"
                >
                    <TypeItalic />
                </Button>
                <Button
                    variant={editorState.isUnderline ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    title="Underline (Ctrl+U)"
                >
                    <TypeUnderline />
                </Button>
                <Button
                    variant={editorState.isStrike ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    title="Strikethrough"
                >
                    <TypeStrikethrough />
                </Button>
            </ButtonGroup>

            {/* Alignment Group */}
            <ButtonGroup size="sm" className="me-2">
                <Button
                    variant={editorState.alignLeft ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    title="Align Left"
                >
                    <TextLeft />
                </Button>
                <Button
                    variant={editorState.alignCenter ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    title="Align Center"
                >
                    <TextCenter />
                </Button>
                <Button
                    variant={editorState.alignRight ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    title="Align Right"
                >
                    <TextRight />
                </Button>
            </ButtonGroup>

            {/* Lists Group */}
            <ButtonGroup size="sm" className="me-2">
                <Button
                    variant={editorState.isBulletList ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Bullet List"
                >
                    <ListUl />
                </Button>
                <Button
                    variant={editorState.isOrderedList ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Numbered List"
                >
                    <ListOl />
                </Button>
            </ButtonGroup>

            {/* Block Elements Group */}
            <ButtonGroup size="sm" className="me-2">
                <Button
                    variant={editorState.isBlockquote ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    title="Quote"
                >
                    <Quote />
                </Button>
                <Button
                    variant={editorState.isCodeBlock ? 'secondary' : 'outline-secondary'}
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    title="Code Block"
                >
                    <CodeSlash />
                </Button>
            </ButtonGroup>

            {/* Media Group - Image Dropdown */}
            <Dropdown className="me-2">
                <Dropdown.Toggle
                    variant="outline-secondary"
                    size="sm"
                    title="Insert Image"
                >
                    <Image />
                </Dropdown.Toggle>
                <Dropdown.Menu>
                    <Dropdown.Item onClick={handleUploadClick}>
                        <CloudUpload className="me-2" />
                        Upload from device
                    </Dropdown.Item>
                    <Dropdown.Item onClick={handleEmbedUrl}>
                        <Link45deg className="me-2" />
                        Embed from URL
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>

            {/* Hidden file input for image upload */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
            />

            {/* Emoji Picker */}
            <Dropdown>
                <Dropdown.Toggle
                    variant="outline-secondary"
                    size="sm"
                    title="Insert Emoji"
                >
                    <EmojiSmile />
                </Dropdown.Toggle>
                <Dropdown.Menu className="emoji-picker-menu">
                    {emojiCategories.map((category) => (
                        <div key={category.name} className="emoji-category">
                            <div className="emoji-category-name">{category.name}</div>
                            <div className="emoji-grid">
                                {category.emojis.map(({ emoji, shortcode }) => (
                                    <button
                                        key={shortcode}
                                        type="button"
                                        className="emoji-btn"
                                        onClick={() => {
                                            editor.chain().focus().setEmoji(shortcode).run();
                                        }}
                                        title={`:${shortcode}:`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="emoji-hint">
                        <small className="text-muted">
                            Tip: Type <code>:emoji_name:</code> to insert emojis
                        </small>
                    </div>
                </Dropdown.Menu>
            </Dropdown>
        </div>
    );
}

export default EditorToolbar;

