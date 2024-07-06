(function() {
    let scene, camera, renderer, stars;

    function init() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 50;

        renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('three-container').appendChild(renderer.domElement);

        // Create stars
        const geometry = new THREE.BufferGeometry();
        const vertices = [];

        for (let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = -Math.random() * 2000;
            vertices.push(x, y, z);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.PointsMaterial({ color: 0xffffff, size: 1, transparent: true });
        stars = new THREE.Points(geometry, material);
        scene.add(stars);

        window.addEventListener('resize', onWindowResize, false);
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        requestAnimationFrame(animate);

        stars.rotation.y += 0.0001;

        renderer.render(scene, camera);
    }

    function setDayNight(theme) {
        if (theme === 'dark') {
            scene.background = new THREE.Color(0x000000);
            stars.material.opacity = 0.8;
        } else {
            scene.background = new THREE.Color(0xfffff0);
            stars.material.opacity = 0.2;
        }
    }

    init();
    animate();

    // Set initial theme
    setDayNight(document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light');

    // Listen for theme changes
    window.addEventListener('themechange', (e) => setDayNight(e.detail));
})();

