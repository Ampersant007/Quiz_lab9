import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filename = path.join(__dirname, 'db.json');

const saveChanges = async (data) => {
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
};

const readData = async () => {
    const data = await fs.readFile(filename, 'utf-8');
    return JSON.parse(data);
};

export const getAll = readData;

export const getById = async (id) => {
    const data = await readData();
    return data.find(item => item.id === id);
};

export const getPaginated = async (page, limit, sort, order, search) => {
    let data = await readData();
    
    if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter(item => 
            item.name.toLowerCase().includes(searchLower)
        );
    }
    
    data.sort((a, b) => {
        let aVal = a[sort];
        let bVal = b[sort];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (order === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
    
    const total = data.length;
    const startIndex = (page - 1) * limit;
    const paginatedData = data.slice(startIndex, startIndex + limit);
    
    return {
        items: paginatedData,
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit),
        hasNext: startIndex + limit < total,
        hasPrev: startIndex > 0
    };
};

export const create = async (name, price) => {
    const data = await readData();
    
    let maxId = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i].id > maxId) {
            maxId = data[i].id;
        }
    }
    const newItem = {
        id: maxId + 1,
        name: name,
        price: parseFloat(price)
    };
    
    data.push(newItem);
    await saveChanges(data);
    return newItem;
};

export const updateById = async (id, newName, newPrice) => {
    const data = await readData();
    
    for (let i = 0; i < data.length; i++) {
        if (data[i].id === id) {
            data[i].name = newName;
            data[i].price = parseFloat(newPrice);
            await saveChanges(data);
            return data[i];
        }
    }    
    return null;
};

export const removeById = async (id) => {
    const data = await readData();    
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    data.splice(index, 1);
    await saveChanges(data);
    return true;
};