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
        this.setupEventListeners();
        this.renderBlogList();
        this.handleUrlParams();
    }

    async loadBlogPosts() {
        try {
            // List of blog files to load
            const blogFiles = [
                'friday-ai-bot-in-mins',
                'genai-comic-strip-krishna.txt',
                'gpt-transformers-explained.txt',
                'parkinsons-law-vs-narayana-murthy.txt',
                'teen-developer-newspaper-head',
            ];

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
        document.querySelector(`[data-tag="${tag}"]`).classList.add('active');

        // Filter posts
        this.currentFilter = tag;
        if (tag === 'all') {
            this.filteredPosts = [...this.blogPosts];
        } else {
            this.filteredPosts = this.blogPosts.filter(post => 
                post.tags.some(postTag => postTag.toLowerCase().includes(tag.toLowerCase()))
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

        const tagsHtml = post.tags.slice(0, 3).map(tag => 
            `<span class="post-tag">${tag}</span>`
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

document.addEventListener('DOMContentLoaded', () => {
    blogManager = new BlogManager();
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
                    // Start matrix effect
                    if (typeof startMatrixEffect === 'function') {
                        startMatrixEffect();
                    }
                }, 500);
            }, 300);
        }
    }, 50);
});
