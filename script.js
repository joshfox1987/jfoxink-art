// Sidebar Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const dropdownContent = document.getElementById('dropdownContent');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navbar = document.getElementById('navbar');
    
    // Desktop dropdown functionality
    if (menuToggle && dropdownContent) {
        menuToggle.addEventListener('click', function() {
            menuToggle.classList.toggle('active');
            dropdownContent.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!menuToggle.contains(event.target) && !dropdownContent.contains(event.target)) {
                menuToggle.classList.remove('active');
                dropdownContent.classList.remove('show');
            }
        });
        
        // Close dropdown when clicking on a link
        document.querySelectorAll('.dropdown-content .nav-link').forEach(link => {
            link.addEventListener('click', function() {
                menuToggle.classList.remove('active');
                dropdownContent.classList.remove('show');
            });
        });
    }

    // Mobile sidebar toggle
    if (mobileMenuToggle && navbar) {
        mobileMenuToggle.addEventListener('click', function() {
            navbar.classList.toggle('active');
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navbar.contains(event.target) && !mobileMenuToggle.contains(event.target)) {
                navbar.classList.remove('active');
            }
        });
        
        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                navbar.classList.remove('active');
            });
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add scroll effect to navbar
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.style.background = 'linear-gradient(135deg, rgba(76,175,80,0.95), rgba(102,187,106,0.95))';
            navbar.style.backdropFilter = 'blur(10px)';
        } else {
            navbar.style.background = 'linear-gradient(135deg, #4CAF50, #66BB6A)';
            navbar.style.backdropFilter = 'none';
        }
    });
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for scroll animations
    document.querySelectorAll('.nav-card, .work-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
    
    // Add hover effects for interactive elements
    document.querySelectorAll('.btn, .card-link, .social-icon').forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05) translateY(-2px)';
        });
        
        element.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1) translateY(0)';
        });
    });
    
    // Dynamic paint splatter movement
    const splatters = document.querySelectorAll('.paint-splatter');
    splatters.forEach((splatter, index) => {
        setInterval(() => {
            const randomX = Math.random() * 20 - 10; // -10 to 10
            const randomY = Math.random() * 20 - 10; // -10 to 10
            splatter.style.transform = `translate(${randomX}px, ${randomY}px)`;
        }, 3000 + index * 1000);
    });
    
    // Add typing effect to hero title (optional enhancement)
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
    
    // Performance optimization: Debounced scroll handler
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Optimized scroll handler
    const handleScroll = debounce(() => {
        const scrolled = window.scrollY;
        const parallax = scrolled * 0.5;
        
        // Parallax effect for hero section
        const heroGraphics = document.querySelector('.hero-graphics');
        if (heroGraphics) {
            heroGraphics.style.transform = `translateY(${parallax}px)`;
        }
    }, 10);
    
    window.addEventListener('scroll', handleScroll);
});

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: var(--gradient-primary);
        color: white;
        border-radius: 10px;
        z-index: 10000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        box-shadow: var(--shadow);
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Export for potential future use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showNotification
    };
}
