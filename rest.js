import express from 'express';
import bodyParser from 'body-parser';
import * as store from './store.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Главная страница с пагинацией, сортировкой и поиском
app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const sort = req.query.sort || 'id';
    const order = req.query.order || 'asc';
    const search = req.query.search || '';

    const result = await store.getPaginated(page, limit, sort, order, search);
    const allItems = await store.getAll();

    // Формируем строку параметров для ссылок
    const paramsStr = `sort=${sort}&order=${order}&search=${search}&limit=${limit}`;

    res.render('index', {
        title: "ЛогикТранс - Управление услугами",
        companyName: "ЛогикТранс",
        year: new Date().getFullYear(),
        services: result.items,
        total: allItems.length,
        currentPage: result.page,
        totalPages: result.totalPages,
        currentSort: sort,
        currentOrder: order,
        currentSearch: search,
        currentLimit: limit,
        paramsStr: paramsStr
    });
});

// Страница викторины
app.get('/quiz', (req, res) => {
    res.render('quiz', {
        title: 'Викторина | ЛогикТранс',
        companyName: 'ЛогикТранс'
    });
});

// GET /items - API для AJAX-операций
app.get('/items', async (req, res) => {
    const hasPagination = req.query.page || req.query.limit || req.query.sort || req.query.search;
    
    if (hasPagination) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const sort = req.query.sort || 'id';
        const order = req.query.order || 'asc';
        const search = req.query.search || '';
        
        const result = await store.getPaginated(page, limit, sort, order, search);
        res.json(result);
    } else {
        const items = await store.getAll();
        res.json(items);
    }
});

// GET /items/:id
app.get('/items/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const item = await store.getById(id);
    
    if (!item) {
        res.status(404).json({ error: 'Запись не найдена' });
    } else {
        res.json(item);
    }
});

// POST /items
app.post('/items', async (req, res) => {
    const { name, price } = req.body;
    
    if (!name || price === undefined) {
        res.status(400).json({ error: 'name и price обязательны' });
    } else {
        const newItem = await store.create(name, price);
        res.status(201).json(newItem);
    }
});

// PUT /items/:id
app.put('/items/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, price } = req.body;
    
    if (!name || price === undefined) {
        res.status(400).json({ error: 'name и price обязательны' });
    } else {
        const updated = await store.updateById(id, name, price);
        
        if (!updated) {
            res.status(404).json({ error: 'Запись не найдена' });
        } else {
            res.json(updated);
        }
    }
});

// DELETE /items/:id
app.delete('/items/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await store.removeById(id);
    
    if (!deleted) {
        res.status(404).json({ error: 'Запись не найдена' });
    } else {
        res.status(204).send();
    }
});

export { app };