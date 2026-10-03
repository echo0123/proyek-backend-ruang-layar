const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Pastikan node-fetch terpasang atau gunakan native fetch di Node versi terbaru
const app = express();

app.use(cors());
app.use(express.json());

// --- DATABASE MEMORI SEMENTARA ---
let totalPageViews = 1420; // Nilai awal penayangan halaman

let users = [
    { 
        name: 'Admin Ruang Layar', 
        email: 'admin@ruanglayar.com', 
        password: 'adminpassword', 
        isAdmin: true, 
        watchlist: [] 
    }
];

let movies = [
    {
        id: 1,
        title: 'Interstellar',
        genre: 'Sci-Fi • Adventure • Drama',
        director: 'Christopher Nolan',
        cast: 'Matthew McConaughey, Anne Hathaway, Jessica Chastain',
        image: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        desc: 'Petualangan sekelompok astronaut yang memanfaatkan lubang cacing (wormhole) demi mencari planet baru bagi kelangsungan umat manusia.',
        rating: 8.7,
        reviews: [
            { 
                user: 'Admin Ruang Layar', 
                rating: 5, 
                comment: 'Film sci-fi terbaik sepanjang masa dengan visual dan musik yang luar biasa!', 
                date: '03 Okt 2026' 
            }
        ]
    }
];

// --- ENDPOINT FILM & KATALOG ---

// 1. Ambil daftar semua film
app.get('/api/movies', (req, res) => {
    res.json(movies);
});

// 2. Ambil detail film berdasarkan ID
app.get('/api/movies/:id', (req, res) => {
    const movie = movies.find(m => m.id == req.params.id);
    if (!movie) return res.status(404).json({ error: 'Film tidak ditemukan' });
    res.json(movie);
});

// --- ENDPOINT OTENTIKASI (USER & ADMIN) ---

// 3. Register Akun Baru
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    const existingUser = users.find(u => u.email === email);
    if (existingUser) return res.status(400).json({ error: 'Email sudah terdaftar!' });

    const newUser = { name, email, password, isAdmin: false, watchlist: [] };
    users.push(newUser);
    res.json({ message: 'Registrasi berhasil!', user: newUser });
});

// 4. Login Akun
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(400).json({ error: 'Email atau password salah!' });
    res.json({ message: 'Berhasil masuk!', user });
});

// --- ENDPOINT WATCHLIST & ULASAN ---

// 5. Tambah/Hapus Watchlist
app.post('/api/watchlist', (req, res) => {
    const { email, movieId } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (!user.watchlist) user.watchlist = [];
    const index = user.watchlist.indexOf(movieId);
    if (index > -1) {
        user.watchlist.splice(index, 1);
        res.json({ message: 'Dihapus dari Watchlist', watchlist: user.watchlist });
    } else {
        user.watchlist.push(movieId);
        res.json({ message: 'Disimpan ke Watchlist', watchlist: user.watchlist });
    }
});

// 6. Ambil Daftar Watchlist User
app.get('/api/watchlist/:email', (req, res) => {
    const user = users.find(u => u.email === req.params.email);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    const watchlistedMovies = movies.filter(m => user.watchlist && user.watchlist.includes(m.id));
    res.json(watchlistedMovies);
});

// 7. Kirim Ulasan Film
app.post('/api/movies/:id/reviews', (req, res) => {
    const { userName, rating, comment } = req.body;
    const movie = movies.find(m => m.id == req.params.id);
    if (!movie) return res.status(404).json({ error: 'Film tidak ditemukan' });

    const newReview = {
        user: userName,
        rating: parseInt(rating),
        comment,
        date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    movie.reviews.push(newReview);
    res.json({ message: 'Ulasan berhasil dikirim!', reviews: movie.reviews });
});

// --- ENDPOINT ADMIN & MANAJEMEN KONTEN ---

// 8. Tambah Film Manual
app.post('/api/admin/movies', (req, res) => {
    const { title, genre, director, cast, image, desc } = req.body;
    const newMovie = {
        id: movies.length > 0 ? Math.max(...movies.map(m => m.id)) + 1 : 1,
        title,
        genre,
        director: director || '-',
        cast: cast || '-',
        image: image || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=500',
        desc,
        rating: (Math.random() * (9.5 - 7.0) + 7.0).toFixed(1),
        reviews: []
    };
    movies.push(newMovie);
    res.json({ message: 'Film berhasil ditambahkan!', movie: newMovie });
});

// 9. Hapus Film
app.delete('/api/admin/movies/:id', (req, res) => {
    const id = parseInt(req.params.id);
    movies = movies.filter(m => m.id !== id);
    res.json({ message: 'Film berhasil dihapus!' });
});

// 10. Impor Film Otomatis dari TMDb API
app.post('/api/admin/import-tmdb', async (req, res) => {
    const { query } = req.body;
    try {
        const url = `https://api.themoviedb.org/3/search/movie?api_key=8265bd1679663a7ea12ac168da84d2e8&language=id-ID&query=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return res.status(404).json({ error: 'Film tidak ditemukan di TMDb.' });
        }

        const item = data.results[0];
        const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=500';
        
        const newMovie = {
            id: movies.length > 0 ? Math.max(...movies.map(m => m.id)) + 1 : 1,
            title: item.title,
            genre: 'Bioskop • Terkini',
            director: 'TMDb Official',
            cast: 'Pemeran Utama TMDb',
            image: posterPath,
            desc: item.overview || 'Sinopsis belum tersedia.',
            rating: item.vote_average ? item.vote_average.toFixed(1) : '8.0',
            reviews: []
        };

        movies.push(newMovie);
        res.json({ message: `Berhasil mengimpor film: ${item.title}`, movie: newMovie });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal terhubung ke TMDb API.' });
    }
});

// --- ENDPOINT STATISTIK TRAFIK & ADMIN (BARU) ---

// 11. Catat Kunjungan Halaman (Page Views)
app.post('/api/track-view', (req, res) => {
    totalPageViews += 1;
    res.json({ success: true, pageViews: totalPageViews });
});

// 12. Ambil Rekap Data & Statistik Admin
app.get('/api/admin/stats', (req, res) => {
    const totalMovies = movies ? movies.length : 0;
    const totalUsers = users ? users.length : 0;
    
    let totalReviews = 0;
    if (movies) {
        movies.forEach(m => {
            if (m.reviews) totalReviews += m.reviews.length;
        });
    }

    res.json({
        pageViews: totalPageViews,
        totalMovies: totalMovies,
        totalUsers: totalUsers,
        totalReviews: totalReviews
    });
});

// Menjalankan Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server backend Ruang Layar berjalan di port ${PORT}`);
});