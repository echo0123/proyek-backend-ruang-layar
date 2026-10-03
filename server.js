const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'ruang_layar_secret_key_2026';

app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [
                { 
                    id: 999, 
                    name: 'Admin Ruang Layar', 
                    email: 'admin@ruanglayar.com', 
                    password: bcrypt.hashSync('admin123', 10), 
                    isAdmin: true,
                    watchlist: []
                }
            ],
            movies: [
                { 
                    id: 1, 
                    title: "Chronicles of Neo", 
                    genre: "Sci-Fi", 
                    rating: 8.8, 
                    desc: "Petualangan futuristik menembus dimensi ruang dan waktu demi menyelamatkan peradaban terakhir manusia.", 
                    director: "Aria Kusuma",
                    cast: "Reza Rahadian, Marissa Anita",
                    image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=600",
                    reviews: [
                        { user: "Budi Santoso", rating: 5, comment: "Efek visualnya luar biasa untuk standar film lokal!", date: "2026-10-01" }
                    ]
                },
                { 
                    id: 2, 
                    title: "Shadows of Jakarta", 
                    genre: "Drama", 
                    rating: 8.2, 
                    desc: "Misteri konspirasi tingkat tinggi di balik gemerlap malam ibu kota yang mengungkap rahasia kelam.", 
                    director: "Dimas Anggara",
                    cast: "Chicco Jerikho, Laura Basuki",
                    image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=600",
                    reviews: [
                        { user: "Siti Rahma", rating: 4, comment: "Alur ceritanya menegangkan dari awal sampai akhir.", date: "2026-10-02" }
                    ]
                }
            ]
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- SEO: DYNAMIC SITEMAP.XML ---
app.get('/sitemap.xml', (req, res) => {
    const db = readDB();
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    xml += '  <url>\n';
    xml += `    <loc>${hostUrl}/</loc>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += '  </url>\n';

    db.movies.forEach(movie => {
        xml += '  <url>\n';
        xml += `    <loc>${hostUrl}/?movie=${movie.id}</loc>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
    });

    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
});

// --- SEO: ROBOTS.TXT ---
app.get('/robots.txt', (req, res) => {
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    let robots = 'User-agent: *\n';
    robots += 'Allow: /\n';
    robots += `Sitemap: ${hostUrl}/sitemap.xml\n`;
    res.header('Content-Type', 'text/plain');
    res.send(robots);
});

// --- API MOVIES ---
app.get('/api/movies', (req, res) => {
    const db = readDB();
    res.json(db.movies);
});

app.get('/api/movies/:id', (req, res) => {
    const db = readDB();
    const movie = db.movies.find(m => m.id == req.params.id);
    if (!movie) return res.status(404).json({ error: 'Film tidak ditemukan' });
    res.json(movie);
});

// --- API REVIEWS ---
app.post('/api/movies/:id/reviews', (req, res) => {
    const { userName, rating, comment } = req.body;
    const db = readDB();
    const movie = db.movies.find(m => m.id == req.params.id);
    if (!movie) return res.status(404).json({ error: 'Film tidak ditemukan' });

    const newReview = {
        user: userName || 'Anonim',
        rating: Number(rating),
        comment,
        date: new Date().toISOString().split('T')[0]
    };

    movie.reviews.unshift(newReview);
    const totalRating = movie.reviews.reduce((acc, r) => acc + r.rating, 0);
    movie.rating = Number((totalRating / movie.reviews.length).toFixed(1));

    writeDB(db);
    res.json({ message: 'Ulasan berhasil ditambahkan!', movie });
});

// --- API AUTH ---
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const db = readDB();
        if (db.users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email sudah terdaftar!' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now(),
            name,
            email,
            password: hashedPassword,
            isAdmin: false,
            watchlist: []
        };
        db.users.push(newUser);
        writeDB(db);
        res.status(201).json({ message: 'Registrasi berhasil!', user: { name, email, isAdmin: false } });
    } catch (err) {
        res.status(500).json({ error: 'Terjadi kesalahan server.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = readDB();
        const user = db.users.find(u => u.email === email);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: 'Email atau password salah!' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ 
            message: 'Login berhasil!', 
            token, 
            user: { name: user.name, email: user.email, isAdmin: user.isAdmin, watchlist: user.watchlist || [] } 
        });
    } catch (err) {
        res.status(500).json({ error: 'Terjadi kesalahan server.' });
    }
});

// --- API WATCHLIST ---
app.post('/api/watchlist', (req, res) => {
    const { email, movieId } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (!user.watchlist) user.watchlist = [];
    const index = user.watchlist.indexOf(movieId);
    
    let message = '';
    if (index > -1) {
        user.watchlist.splice(index, 1);
        message = 'Film dihapus dari Watchlist.';
    } else {
        user.watchlist.push(movieId);
        message = 'Film ditambahkan ke Watchlist!';
    }

    writeDB(db);
    res.json({ message, watchlist: user.watchlist });
});

app.get('/api/watchlist/:email', (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.email === req.params.email);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    const watchlistMovies = db.movies.filter(m => (user.watchlist || []).includes(m.id));
    res.json(watchlistMovies);
});

// --- API ADMIN: ADD MOVIE ---
app.post('/api/admin/movies', (req, res) => {
    const { title, genre, rating, desc, director, cast, image } = req.body;
    const db = readDB();

    const newMovie = {
        id: Date.now(),
        title,
        genre,
        rating: Number(rating) || 8.0,
        desc,
        director: director || 'Tidak diketahui',
        cast: cast || 'Tidak diketahui',
        image: image || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=600',
        reviews: []
    };

    db.movies.unshift(newMovie);
    writeDB(db);
    res.status(201).json({ message: 'Film berhasil ditambahkan!', movie: newMovie });
});

// --- API ADMIN: DELETE MOVIE ---
app.delete('/api/admin/movies/:id', (req, res) => {
    const db = readDB();
    const index = db.movies.findIndex(m => m.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Film tidak ditemukan' });

    db.movies.splice(index, 1);
    writeDB(db);
    res.json({ message: 'Film berhasil dihapus!' });
});

// --- API ADMIN: IMPORT FROM TMDB API ---
app.post('/api/admin/import-tmdb', async (req, res) => {
    const { query } = req.body;
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=2b1573359d9ca7a8c54170366eb9034d&query=${encodeURIComponent(query)}&language=id-ID`;
        const response = await fetch(tmdbUrl);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return res.status(404).json({ error: 'Film tidak ditemukan di TMDb API.' });
        }

        const item = data.results[0];
        const db = readDB();

        const importedMovie = {
            id: Date.now(),
            title: item.title,
            genre: "Bioskop / Trending",
            rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : 7.5,
            desc: item.overview || 'Tidak ada deskripsi.',
            director: 'TMDb Featured',
            cast: 'Aktor Global',
            image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=600',
            reviews: []
        };

        db.movies.unshift(importedMovie);
        writeDB(db);

        res.json({ message: `Berhasil mengimpor "${item.title}" dari TMDb API!`, movie: importedMovie });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal terhubung ke TMDb API.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server Ruang Layar berjalan di http://localhost:${PORT}`);
});