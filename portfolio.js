// Portfolio filtering functionality
document.addEventListener('DOMContentLoaded', function() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    if (filterButtons.length > 0 && galleryItems.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Get filter category
                const filterValue = this.getAttribute('data-filter');
                
                // Filter gallery items
                galleryItems.forEach(item => {
                    const itemCategory = item.getAttribute('data-category');
                    
                    if (filterValue === 'all' || itemCategory === filterValue) {
                        item.style.display = 'block';
                        item.style.opacity = '0';
                        item.style.transform = 'scale(0.8)';
                        
                        // Animate in
                        setTimeout(() => {
                            item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                            item.style.opacity = '1';
                            item.style.transform = 'scale(1)';
                        }, 100);
                    } else {
                        item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        item.style.opacity = '0';
                        item.style.transform = 'scale(0.8)';
                        
                        // Hide after animation
                        setTimeout(() => {
                            item.style.display = 'none';
                        }, 300);
                    }
                });
            });
        });
        
        // Initialize with animation
        setTimeout(() => {
            galleryItems.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(30px)';
                
                setTimeout(() => {
                    item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, index * 100);
            });
        }, 500);
    }
    
    // View button functionality for portfolio items
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const item = this.closest('.gallery-item');
            const title = item.querySelector('.item-overlay h4').textContent;
            
            if (typeof showNotification === 'function') {
                showNotification(`Opening ${title} - Feature coming soon!`, 'info');
            }
        });
    });
});
