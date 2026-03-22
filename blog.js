// Blog functionality
class BlogManager {
    constructor() {
        this.blogPosts = [];
        this.filteredPosts = [];
        this.currentPage = 1;
        this.postsPerPage = 6;
        this.currentFilter = 'all';
        this.currentPost = null;
        
        this.init();
    }

    async init() {
        await this.loadBlogPosts();
        this.buildFilterButtons();
        this.setupEventListeners();
        this.renderBlogList();
        this.handleUrlParams();
    }

    async loadBlogPosts() {
        try {
            let blogFiles;

            // Try fetching the auto-generated index first (works on GitHub Pages)
            try {
                const indexResponse = await fetch('blogs/index.json');
                if (indexResponse.ok) {
                    blogFiles = await indexResponse.json();
                } else {
                    throw new Error('index.json not available');
                }
            } catch {
                // Fallback list for local development or if index.json isn't deployed yet
                blogFiles = [
                    'friday-ai-bot-in-mins',
                    'genai-comic-strip-krishna.txt',
                    'gpt-transformers-explained.txt',
                    'parkinsons-law-vs-narayana-murthy.txt',
                    'teen-developer-newspaper-headlines.txt',
                ];
            }

            const posts = [];
            
            for (const filename of blogFiles) {
                try {
                    const response = await fetch(`blogs/${filename}`);
                    if (response.ok) {
                        const content = await response.text();
                        const post = this.parseBlogPost(content, filename);
                        if (post) {
                            posts.push(post);
                        }
                    } else {
                        console.warn(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
                    }
                } catch (error) {
                    console.warn(`Failed to load blog post: ${filename}`, error);
                }
            }

            // Sort posts by date (newest first)
            this.blogPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.filteredPosts = [...this.blogPosts];
            
            console.log(`Loaded ${this.blogPosts.length} blog posts`, this.blogPosts);
            
            if (this.blogPosts.length === 0) {
                this.showErrorMessage('No blog posts found. Please check that the blog files exist in the blogs folder.');
            }
        } catch (error) {
            console.error('Error loading blog posts:', error);
            this.showErrorMessage('Failed to load blog posts. Please try again later.');
        }
    }

    // Category mapping: maps individual tags to broader sections
    static TAG_TO_CATEGORY = {
        // AI / ML
        'ai': 'AI/ML',
        'artificial intelligence': 'AI/ML',
        'machine learning': 'AI/ML',
        'gpt': 'AI/ML',
        'transformers': 'AI/ML',
        'llm': 'AI/ML',
        'deep learning': 'AI/ML',
        'neural networks': 'AI/ML',
        'genai': 'AI/ML',
        'amazon bedrock': 'AI/ML',
        // Cloud & DevOps
        'aws': 'Cloud & DevOps',
        'serverless': 'Cloud & DevOps',
        'cloudformation': 'Cloud & DevOps',
        'lambda': 'Cloud & DevOps',
        'devops': 'Cloud & DevOps',
        // Creative
        'creative ai': 'Creative',
        'comic strip': 'Creative',
        'digital art': 'Creative',
        // Productivity
        'productivity': 'Productivity',
        'work-life balance': 'Productivity',
        'time management': 'Productivity',
        'leadership': 'Productivity',
        "parkinson's law": 'Productivity',
        // Stories
        'teen developer': 'Stories',
        'entrepreneurship': 'Stories',
        'community impact': 'Stories',
        'success story': 'Stories',
        // Projects
        'chatbot': 'Projects',
        'open source': 'Projects',
        'mobile app development': 'Projects',
    };

    getCategoriesForPost(post) {
        const categories = new Set();
        for (const tag of post.tags) {
            const cat = BlogManager.TAG_TO_CATEGORY[tag.toLowerCase()];
            if (cat) categories.add(cat);
        }
        // If no category matched, put it in "Other"
        if (categories.size === 0) categories.add('Other');
        return [...categories];
    }

    buildFilterButtons() {
        // Collect all categories across posts
        const categorySet = new Set();
        for (const post of this.blogPosts) {
            const cats = this.getCategoriesForPost(post);
            cats.forEach(c => categorySet.add(c));
        }

        // Desired display order
        const order = ['AI/ML', 'Cloud & DevOps', 'Creative', 'Productivity', 'Stories', 'Projects', 'Other'];
        const sorted = order.filter(c => categorySet.has(c));

        const container = document.getElementById('blog-filters');
        if (!container) return;

        // Keep the "All" button, add category buttons
        let html = '<button class="filter-btn active" data-tag="all">All Posts</button>';
        for (const cat of sorted) {
            html += `<button class="filter-btn" data-tag="${cat}">${cat}</button>`;
        }
        container.innerHTML = html;
    }

    parseBlogPost(content, filename) {
        try {
            const lines = content.split('\n');
            const metadata = {};
            let contentStart = 0;

            // Parse metadata
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === '') {
                    contentStart = i + 1;
                    break;
                }
                
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
                    metadata[key.toLowerCase()] = value;
                }
            }

            // Get content (everything after metadata)
            const markdownContent = lines.slice(contentStart).join('\n');
            
            // Generate excerpt from content
            const excerpt = this.generateExcerpt(markdownContent);
            
            // Generate slug from filename
            const slug = filename.replace('.txt', '');

            return {
                slug,
                title: metadata.title || 'Untitled',
                date: metadata.date || new Date().toISOString().split('T')[0],
                author: metadata.author || 'Anonymous',
                tags: metadata.tags ? metadata.tags.split(',').map(tag => tag.trim()) : [],
                image: metadata.image || null,
                excerpt,
                content: markdownContent,
                filename
            };
        } catch (error) {
            console.error(`Error parsing blog post ${filename}:`, error);
            return null;
        }
    }

    generateExcerpt(content, maxLength = 200) {
        // Remove markdown headers and get first paragraph
        const cleanContent = content
            .replace(/^#.*$/gm, '') // Remove headers
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
            .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
            .trim();

        const firstParagraph = cleanContent.split('\n\n')[0];
        
        if (firstParagraph.length <= maxLength) {
            return firstParagraph;
        }
        
        return firstParagraph.substring(0, maxLength).trim() + '...';
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tag = e.target.dataset.tag;
                this.filterPosts(tag);
            });
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderBlogList();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderBlogList();
            }
        });

        // Back to list button
        document.getElementById('back-to-list').addEventListener('click', () => {
            this.showBlogList();
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            this.handleUrlParams();
        });
    }

    filterPosts(tag) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-tag="${tag}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Filter posts by category
        this.currentFilter = tag;
        if (tag === 'all') {
            this.filteredPosts = [...this.blogPosts];
        } else {
            this.filteredPosts = this.blogPosts.filter(post => 
                this.getCategoriesForPost(post).includes(tag)
            );
        }

        this.currentPage = 1;
        this.renderBlogList();
    }

    renderBlogList() {
        const container = document.getElementById('blog-posts-container');
        const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
        
        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.postsPerPage;
        const endIndex = startIndex + this.postsPerPage;
        const postsToShow = this.filteredPosts.slice(startIndex, endIndex);

        // Render posts
        if (postsToShow.length === 0) {
            container.innerHTML = `
                <div class="no-posts">
                    <i class="fas fa-search"></i>
                    <h3>No posts found</h3>
                    <p>Try adjusting your filters or check back later for new content.</p>
                </div>
            `;
        } else {
            container.innerHTML = postsToShow.map(post => this.createPostCard(post)).join('');
        }

        // Update pagination
        this.updatePagination(totalPages);

        // Add click listeners to post cards
        container.querySelectorAll('.blog-card').forEach(card => {
            card.addEventListener('click', () => {
                const slug = card.dataset.slug;
                this.showBlogPost(slug);
            });
        });
    }

    createPostCard(post) {
        const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const categories = this.getCategoriesForPost(post);
        const categoryHtml = categories.map(cat => 
            `<span class="post-tag">${cat}</span>`
        ).join('');

        const tagsHtml = post.tags.slice(0, 3).map(tag => 
            `<span class="post-tag post-tag-secondary">${tag}</span>`
        ).join('');

        return `
            <article class="blog-card" data-slug="${post.slug}">
                <div class="blog-card-header">
                    ${post.image ? `<div class="blog-card-image">
                        <img src="${post.image}" alt="${post.title}" onerror="this.style.display='none'">
                    </div>` : ''}
                    <div class="blog-card-meta">
                        <span class="blog-date">
                            <i class="fas fa-calendar"></i> ${formattedDate}
                        </span>
                        <span class="blog-author">
                            <i class="fas fa-user"></i> ${post.author}
                        </span>
                    </div>
                </div>
                <div class="blog-card-content">
                    <div class="blog-card-categories">
                        ${categoryHtml}
                    </div>
                    <h3 class="blog-card-title">${post.title}</h3>
                    <p class="blog-card-excerpt">${post.excerpt}</p>
                    <div class="blog-card-tags">
                        ${tagsHtml}
                    </div>
                </div>
                <div class="blog-card-footer">
                    <span class="read-more">
                        Read More <i class="fas fa-arrow-right"></i>
                    </span>
                </div>
            </article>
        `;
    }

    updatePagination(totalPages) {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const currentPageSpan = document.getElementById('current-page');
        const totalPagesSpan = document.getElementById('total-pages');

        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= totalPages;
        currentPageSpan.textContent = this.currentPage;
        totalPagesSpan.textContent = totalPages;
    }

    async showBlogPost(slug) {
        const post = this.blogPosts.find(p => p.slug === slug);
        if (!post) {
            console.error('Post not found:', slug);
            return;
        }

        this.currentPost = post;
        
        // Update URL
        const newUrl = `${window.location.pathname}?post=${slug}`;
        history.pushState({ post: slug }, post.title, newUrl);
        
        // Update page title
        document.title = `${post.title} - WhyShock Blog`;

        // Render post content
        await this.renderBlogPost(post);
        
        // Show post view
        document.getElementById('blog-list-view').style.display = 'none';
        document.getElementById('blog-post-view').style.display = 'block';
        
        // Scroll to top
        window.scrollTo(0, 0);
    }

    async renderBlogPost(post) {
        const formattedDate = new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Update meta information
        document.getElementById('post-date').innerHTML = `<i class="fas fa-calendar"></i> ${formattedDate}`;
        document.getElementById('post-author').innerHTML = `<i class="fas fa-user"></i> ${post.author}`;
        
        const tagsHtml = post.tags.map(tag => `<span class="post-tag">${tag}</span>`).join('');
        document.getElementById('post-tags').innerHTML = tagsHtml;

        // Handle post image
        const imageContainer = document.getElementById('post-image-container');
        const postImage = document.getElementById('post-image');
        
        if (post.image) {
            postImage.src = post.image;
            postImage.alt = post.title;
            imageContainer.style.display = 'block';
        } else {
            imageContainer.style.display = 'none';
        }

        // Render markdown content
        const htmlContent = marked.parse(post.content);
        document.getElementById('post-body').innerHTML = htmlContent;

        // Highlight code blocks
        if (window.Prism) {
            Prism.highlightAll();
        }

        // Setup image zoom on all post images
        this.setupImageZoom();
    }

    setupImageZoom() {
        const postBody = document.getElementById('post-body');
        const images = postBody.querySelectorAll('img');
        images.forEach(img => {
            img.style.cursor = 'zoom-in';
            img.addEventListener('click', () => {
                imageZoom.open(img.src, img.alt);
            });
        });
    }

    showBlogList() {
        // Update URL
        const newUrl = window.location.pathname;
        history.pushState({}, 'WhyShock Blog', newUrl);
        
        // Update page title
        document.title = 'WhyShock - Tech Blog';
        
        // Show list view
        document.getElementById('blog-post-view').style.display = 'none';
        document.getElementById('blog-list-view').style.display = 'block';
        
        this.currentPost = null;
    }

    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const postSlug = urlParams.get('post');
        
        if (postSlug) {
            this.showBlogPost(postSlug);
        } else {
            this.showBlogList();
        }
    }

    showErrorMessage(message) {
        const container = document.getElementById('blog-posts-container');
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-primary">
                    <i class="fas fa-refresh"></i> Retry
                </button>
            </div>
        `;
    }
}

// Social sharing functions
function sharePost(platform) {
    if (!blogManager.currentPost) return;
    
    const post = blogManager.currentPost;
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(post.title);
    const text = encodeURIComponent(post.excerpt);
    
    let shareUrl = '';
    
    switch (platform) {
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}&via=whyshock`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
            break;
        default:
            return;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
}

function copyPostUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        // Show notification
        showNotification('Link copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Link copied to clipboard!', 'success');
    });
}

// Initialize blog manager when DOM is loaded
let blogManager;
let readingToolbar;
let imageZoom;

document.addEventListener('DOMContentLoaded', () => {
    blogManager = new BlogManager();
    readingToolbar = new ReadingToolbar();
    imageZoom = new ImageZoom();
});

// Handle loading screen for blog page
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingProgress = document.querySelector('.loading-progress');
    const loadingPercentage = document.querySelector('.loading-percentage');
    let progress = 0;
    
    const loadingInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress > 100) progress = 100;
        
        loadingProgress.style.width = progress + '%';
        loadingPercentage.textContent = Math.floor(progress) + '%';
        
        if (progress >= 100) {
            clearInterval(loadingInterval);
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    if (typeof startMatrixEffect === 'function') {
                        startMatrixEffect();
                    }
                }, 500);
            }, 300);
        }
    }, 50);
});

// ============================================
// READING TOOLBAR
// ============================================
class ReadingToolbar {
    constructor() {
        this.fontSize = 100; // percentage
        this.minFont = 80;
        this.maxFont = 150;
        this.step = 10;
        this.currentWidth = 'normal'; // narrow, normal, wide
        this.setupControls();
        this.setupProgressBar();
    }

    setupControls() {
        const increase = document.getElementById('font-increase');
        const decrease = document.getElementById('font-decrease');
        const reset = document.getElementById('font-reset');
        const narrow = document.getElementById('width-narrow');
        const normal = document.getElementById('width-normal');
        const wide = document.getElementById('width-wide');

        if (increase) increase.addEventListener('click', () => this.changeFontSize(this.step));
        if (decrease) decrease.addEventListener('click', () => this.changeFontSize(-this.step));
        if (reset) reset.addEventListener('click', () => this.resetFontSize());
        if (narrow) narrow.addEventListener('click', () => this.setWidth('narrow'));
        if (normal) normal.addEventListener('click', () => this.setWidth('normal'));
        if (wide) wide.addEventListener('click', () => this.setWidth('wide'));
    }

    changeFontSize(delta) {
        this.fontSize = Math.min(this.maxFont, Math.max(this.minFont, this.fontSize + delta));
        this.applyFontSize();
    }

    resetFontSize() {
        this.fontSize = 100;
        this.applyFontSize();
    }

    applyFontSize() {
        const postBody = document.getElementById('post-body');
        if (postBody) {
            postBody.style.fontSize = (this.fontSize / 100 * 1.05) + 'rem';
        }
        const display = document.getElementById('font-size-display');
        if (display) display.textContent = this.fontSize + '%';
    }

    setWidth(mode) {
        this.currentWidth = mode;
        const article = document.getElementById('blog-post-article');
        if (!article) return;

        const widths = { narrow: '680px', normal: '860px', wide: '1100px' };
        article.style.maxWidth = widths[mode];

        // Update active button
        ['width-narrow', 'width-normal', 'width-wide'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.remove('active');
        });
        const activeBtn = document.getElementById('width-' + mode);
        if (activeBtn) activeBtn.classList.add('active');
    }

    setupProgressBar() {
        window.addEventListener('scroll', () => {
            const postView = document.getElementById('blog-post-view');
            if (!postView || postView.style.display === 'none') return;

            const progressBar = document.getElementById('reading-progress');
            if (!progressBar) return;

            const article = document.getElementById('blog-post-article');
            if (!article) return;

            const rect = article.getBoundingClientRect();
            const articleTop = rect.top + window.scrollY;
            const articleHeight = article.offsetHeight;
            const scrolled = window.scrollY - articleTop;
            const viewportHeight = window.innerHeight;
            const progress = Math.min(100, Math.max(0, (scrolled / (articleHeight - viewportHeight)) * 100));

            progressBar.style.width = progress + '%';
        });
    }
}

// ============================================
// IMAGE ZOOM
// ============================================
class ImageZoom {
    constructor() {
        this.overlay = document.getElementById('image-zoom-overlay');
        this.zoomImg = document.getElementById('zoom-image');
        this.scale = 1;
        this.minScale = 0.5;
        this.maxScale = 3;
        this.setupControls();
    }

    setupControls() {
        const closeBtn = document.getElementById('zoom-close');
        const zoomIn = document.getElementById('zoom-in-btn');
        const zoomOut = document.getElementById('zoom-out-btn');
        const zoomReset = document.getElementById('zoom-reset-btn');

        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (zoomIn) zoomIn.addEventListener('click', (e) => { e.stopPropagation(); this.zoom(0.25); });
        if (zoomOut) zoomOut.addEventListener('click', (e) => { e.stopPropagation(); this.zoom(-0.25); });
        if (zoomReset) zoomReset.addEventListener('click', (e) => { e.stopPropagation(); this.resetZoom(); });

        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (!this.overlay || !this.overlay.classList.contains('active')) return;
            if (e.key === 'Escape') this.close();
            if (e.key === '+' || e.key === '=') this.zoom(0.25);
            if (e.key === '-') this.zoom(-0.25);
        });
    }

    open(src, alt) {
        if (!this.overlay || !this.zoomImg) return;
        this.scale = 1;
        this.zoomImg.src = src;
        this.zoomImg.alt = alt || '';
        this.zoomImg.style.transform = 'scale(1)';
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        if (!this.overlay) return;
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    zoom(delta) {
        this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale + delta));
        if (this.zoomImg) this.zoomImg.style.transform = `scale(${this.scale})`;
    }

    resetZoom() {
        this.scale = 1;
        if (this.zoomImg) this.zoomImg.style.transform = 'scale(1)';
    }
}

// ============================================
// NOTIFICATION HELPER
// ============================================
function showNotification(message) {
    let toast = document.querySelector('.notification-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'notification-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}
