(function() {
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;

    function setTheme(theme) {
        if (theme === 'light') {
            html.classList.remove('dark-theme');
        } else {
            html.classList.add('dark-theme');
        }
        localStorage.setItem('theme', theme);
        window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
    }

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    }

    // Theme toggle functionality
    themeToggle.addEventListener('click', () => {
        html.classList.toggle('dark-theme');
        const newTheme = html.classList.contains('dark-theme') ? 'dark' : 'light';
        setTheme(newTheme);
    });

    // Keyboard accessibility
    themeToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            themeToggle.click();
        }
    });
})();

