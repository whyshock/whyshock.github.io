// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const themeToggle = document.getElementById('theme-toggle');
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const contactForm = document.getElementById('contact-form');

// Loading Screen Animation
window.addEventListener('load', () => {
    const loadingProgress = document.querySelector('.loading-progress');
    const loadingPercentage = document.querySelector('.loading-percentage');
    let progress = 0;
    
    const loadingInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 100) progress = 100;
        
        loadingProgress.style.width = progress + '%';
        loadingPercentage.textContent = Math.floor(progress) + '%';
        
        if (progress >= 100) {
            clearInterval(loadingInterval);
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    initializeAnimations();
                    // Start matrix effect after loading is complete
                    startMatrixEffect();
                }, 500);
            }, 500);
        }
    }, 100);
});

// Theme Toggle Functionality
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const body = document.body;
        const icon = themeToggle.querySelector('i');
        
        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            localStorage.setItem('theme', 'light');
        } else {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
        }
    });
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme && themeToggle) {
    const body = document.body;
    const icon = themeToggle.querySelector('i');
    
    if (savedTheme === 'light') {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// Mobile Navigation Toggle
if (hamburger) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        
        // Animate hamburger
        const spans = hamburger.querySelectorAll('span');
        if (hamburger.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
        } else {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    });
}

// Close mobile menu when clicking on nav links
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        
        const spans = hamburger.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
    });
});

// Experience Accordion Toggle
function toggleExp(card) {
    card.classList.toggle('open');
}

// Certification Card Toggle
function toggleCert(card) {
    card.classList.toggle('open');
}

// Project Card Toggle
function toggleProj(card) {
    card.classList.toggle('open');
}

// Smooth Scrolling Function
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Active Navigation Link Highlighting
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

// Scroll event listener
window.addEventListener('scroll', () => {
    updateActiveNavLink();
    
    // Navbar hover effect and background on scroll
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Animated Counter for Stats
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        const increment = target / 100;
        let current = 0;
        
        const updateCounter = () => {
            if (current < target) {
                current += increment;
                counter.textContent = Math.ceil(current);
                setTimeout(updateCounter, 20);
            } else {
                counter.textContent = target;
            }
        };
        
        updateCounter();
    });
}

// Intersection Observer for Animations
function initializeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // Trigger counter animation for stats section
                if (entry.target.classList.contains('about-stats')) {
                    animateCounters();
                }
                
                // Add staggered animation for project cards
                if (entry.target.classList.contains('projects-grid')) {
                    const cards = entry.target.querySelectorAll('.project-card');
                    cards.forEach((card, index) => {
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        }, index * 100);
                    });
                }
                
                // Add staggered animation for skill items
                if (entry.target.classList.contains('skills-grid') || entry.target.classList.contains('skills-categories-detailed')) {
                    const skills = entry.target.querySelectorAll('.skill-item');
                    skills.forEach((skill, index) => {
                        setTimeout(() => {
                            skill.style.opacity = '1';
                            skill.style.transform = 'translateY(0)';
                        }, index * 50);
                    });
                }
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.section-title, .about-content, .about-stats, .projects-grid, .skills-content, .skills-categories-detailed, .contact-content');
    animatedElements.forEach(el => observer.observe(el));
    
    // Initially set up project cards and skill items for animation
    const projectCards = document.querySelectorAll('.project-card');
    const skillItems = document.querySelectorAll('.skill-item');
    
    projectCards.forEach(card => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    });
    
    skillItems.forEach(skill => {
        skill.style.opacity = '1';
        skill.style.transform = 'translateY(0)';
    });
}

// Contact Form Handling
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const name = formData.get('name');
        const email = formData.get('email');
        const message = formData.get('message');
        
        // Simple form validation
        if (!name || !email || !message) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        // Simulate form submission
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> MESSAGE SENT!';
            showNotification('Message sent successfully! I\'ll get back to you soon.', 'success');
            contactForm.reset();
            
            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 2000);
        }, 2000);
    });
}

// Email validation function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    // Add notification styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--card-bg);
        color: var(--text-secondary);
        padding: 1rem 1.5rem;
        border-radius: 10px;
        border: 1px solid var(--border-color);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
        box-shadow: 0 10px 30px var(--shadow-color);
    `;
    
    if (type === 'success') {
        notification.style.borderColor = '#10b981';
    } else if (type === 'error') {
        notification.style.borderColor = '#ef4444';
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

// Enhanced Matrix Rain Effect with Words and Numbers — Canvas-based for smooth continuous rain
function createMatrixRain() {
    const matrixContainer = document.querySelector('.matrix-rain');
    if (!matrixContainer) return;

    matrixContainer.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    matrixContainer.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = matrixContainer.offsetWidth;
        canvas.height = matrixContainer.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const words = [
        'AWS','CLOUD','AI','ML','API','CODE','DATA','TECH','DEV','OPS',
        'PYTHON','JS','REACT','NODE','DOCKER','K8S','GIT','SQL','HTTP',
        'LAMBDA','S3','EC2','RDS','VPC','IAM','SQS','SNS','ECS','EKS',
        'TENSORFLOW','PYTORCH','KERAS','OPENCV','NUMPY','PANDAS',
        'AZURE','GCP','TERRAFORM','JENKINS','NGINX',
        'REDIS','MONGODB','POSTGRES','KAFKA','SPARK',
        'BLOCKCHAIN','NEURAL','DEEP','VISION','NLP','GPU',
        '01','10','101','110','1010','1100','0011','1001'
    ];

    const colW = 60;
    const cols = Math.ceil(canvas.width / colW) + 2;

    // Each column tracks its own drops
    const drops = [];
    for (let i = 0; i < cols; i++) {
        const speed = 0.4 + Math.random() * 0.8; // px per frame
        const fontSize = 10 + Math.random() * 4;
        drops.push({
            x: i * colW + Math.random() * 10,
            y: -Math.random() * canvas.height, // stagger start
            speed,
            fontSize,
            opacity: 0.3 + Math.random() * 0.4,
            words: [],
        });
        // Pre-fill words for this column
        const count = 20 + Math.floor(Math.random() * 15);
        for (let j = 0; j < count; j++) {
            drops[i].words.push(words[Math.floor(Math.random() * words.length)]);
        }
    }

    let animId;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const col of drops) {
            ctx.font = `${col.fontSize}px Orbitron, monospace`;
            ctx.textAlign = 'center';
            const lineH = col.fontSize * 1.8;
            const totalH = col.words.length * lineH;

            for (let j = 0; j < col.words.length; j++) {
                const wy = col.y + j * lineH;
                // Only draw if on screen
                if (wy < -lineH || wy > canvas.height + lineH) continue;

                // Highlight some words
                if (j % 12 === 0) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${col.opacity * 0.9})`;
                    ctx.shadowColor = '#ffffff';
                    ctx.shadowBlur = 8;
                } else if (j % 7 === 0) {
                    ctx.fillStyle = `rgba(59, 130, 246, ${col.opacity * 0.9})`;
                    ctx.shadowColor = '#3b82f6';
                    ctx.shadowBlur = 6;
                } else {
                    ctx.fillStyle = `rgba(0, 212, 255, ${col.opacity})`;
                    ctx.shadowColor = '#00d4ff';
                    ctx.shadowBlur = 4;
                }

                ctx.fillText(col.words[j], col.x, wy);
            }
            ctx.shadowBlur = 0;

            // Move column down
            col.y += col.speed;

            // When the entire column has scrolled past the bottom, reset to top
            if (col.y > canvas.height + 20) {
                col.y = -totalH;
                // Shuffle words for variety
                for (let j = col.words.length - 1; j > 0; j--) {
                    const k = Math.floor(Math.random() * (j + 1));
                    [col.words[j], col.words[k]] = [col.words[k], col.words[j]];
                }
            }
        }

        animId = requestAnimationFrame(draw);
    }

    draw();

    // Store cleanup ref
    matrixContainer._stopRain = () => cancelAnimationFrame(animId);
}

// Start matrix after loading
function startMatrixEffect() {
    const matrixContainer = document.querySelector('.matrix-rain');
    if (matrixContainer) {
        createMatrixRain();
        matrixContainer.classList.add('active');
    }
}

// Particle System for Background
function createParticleSystem() {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-system';
    particleContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
    `;
    
    document.body.appendChild(particleContainer);
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: var(--text-primary);
            border-radius: 50%;
            opacity: 0.3;
            animation: float ${10 + Math.random() * 20}s linear infinite;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
        `;
        
        particleContainer.appendChild(particle);
    }
}

// Add CSS animations for particles and matrix
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% { transform: translateY(0px) rotate(0deg); opacity: 0; }
        10% { opacity: 0.3; }
        90% { opacity: 0.3; }
        100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
    }
    
    @keyframes matrix-fall {
        0% { transform: translateY(-100vh); }
        100% { transform: translateY(100vh); }
    }
    
    .matrix-column {
        pointer-events: none;
    }
    
    .animate-in {
        animation: slideInUp 0.8s ease forwards;
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .notification-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
    }
    
    .notification-close:hover {
        color: var(--text-primary);
    }
`;
document.head.appendChild(style);

// Typing Effect for Hero Title
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.innerHTML = '';
    
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create enhanced background effects
    setTimeout(() => {
        createMatrixRain();
        createParticleSystem();
    }, 1000);
    
    // Removed glitch effect for professional appearance
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Toggle theme with Ctrl/Cmd + T
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        themeToggle.click();
    }
    
    // Navigate sections with arrow keys
    if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        const sections = ['home', 'about', 'projects', 'skills', 'contact'];
        const currentSection = window.location.hash.replace('#', '') || 'home';
        const currentIndex = sections.indexOf(currentSection);
        const nextIndex = (currentIndex + 1) % sections.length;
        scrollToSection(sections[nextIndex]);
    }
    
    if (e.key === 'ArrowUp' && e.ctrlKey) {
        e.preventDefault();
        const sections = ['home', 'about', 'projects', 'skills', 'contact'];
        const currentSection = window.location.hash.replace('#', '') || 'home';
        const currentIndex = sections.indexOf(currentSection);
        const prevIndex = currentIndex === 0 ? sections.length - 1 : currentIndex - 1;
        scrollToSection(sections[prevIndex]);
    }
});

// Performance optimization: Throttle scroll events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Apply throttling to scroll event
window.addEventListener('scroll', throttle(() => {
    updateActiveNavLink();
}, 100));

// Font Size Controls
let currentScale = 100;
document.addEventListener('DOMContentLoaded', function() {
    var fontUp = document.getElementById('font-up');
    var fontDown = document.getElementById('font-down');
    if (fontUp) {
        fontUp.addEventListener('click', function() {
            if (currentScale < 130) {
                currentScale += 8;
                document.documentElement.style.setProperty('font-size', currentScale + '%', 'important');
            }
        });
    }
    if (fontDown) {
        fontDown.addEventListener('click', function() {
            if (currentScale > 85) {
                currentScale -= 8;
                document.documentElement.style.setProperty('font-size', currentScale + '%', 'important');
            }
        });
    }
});

// Download Resume Function
function downloadResume() {
    const link = document.createElement('a');
    link.href = 'Profile.pdf';
    link.download = 'Vaishakh_I_Kuppast_Resume.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Console Easter Egg
console.log(`
    ╔══════════════════════════════════════╗
    ║          WHYSHOCK PORTFOLIO          ║
    ║                                      ║
    ║    Welcome to the cyberpunk world!   ║
    ║                                      ║
    ║    Keyboard Shortcuts:               ║
    ║    • Ctrl/Cmd + T: Toggle theme      ║
    ║    • Ctrl + ↑/↓: Navigate sections   ║
    ║                                      ║
    ║    Built with ❤️ and lots of ☕      ║
    ╚══════════════════════════════════════╝
`);

// Neural Network Canvas Animation
function initNeuralCanvas() {
    const canvas = document.getElementById('neural-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const nodes = [];
    const nodeCount = Math.min(40, Math.floor(window.innerWidth / 35));
    const connectionDistance = 180;

    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: 1.5 + Math.random() * 2,
            pulse: Math.random() * Math.PI * 2
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < connectionDistance) {
                    const alpha = (1 - dist / connectionDistance) * 0.15;
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        for (const node of nodes) {
            node.pulse += 0.02;
            const glow = 0.4 + Math.sin(node.pulse) * 0.3;

            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 212, 255, ${glow})`;
            ctx.fill();

            // Move
            node.x += node.vx;
            node.y += node.vy;

            // Bounce off edges
            if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
            if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
        }

        requestAnimationFrame(draw);
    }

    draw();
}


// Initialize neural canvas and AI icons after load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initNeuralCanvas();
    }, 1500);
});
