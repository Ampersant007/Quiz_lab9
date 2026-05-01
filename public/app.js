const url = '/items';

// Добавить услугу
async function addItem() {
    const name = document.getElementById('name').value.trim();
    const price = document.getElementById('price').value;
    
    if (!name || !price) {
        showMessage('Заполните все поля!');
        return;
    }
    
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, price: parseFloat(price)})
        });
        
        if (resp.ok) {
            showMessage('✅ Добавлено!');
            document.getElementById('name').value = '';
            document.getElementById('price').value = '';
            // Перезагружаем страницу с параметрами
            window.location.href = '/?page=1&sort=id&order=asc&limit=5';
        } else {
            showMessage('❌ Ошибка при добавлении');
        }
    } catch (error) {
        showMessage('❌ Ошибка: ' + error.message);
    }
}

// Редактировать услугу
async function editItem(id) {
    const newName = prompt('Новое название');
    if (!newName) return;
    
    const newPrice = prompt('Новая цена');
    if (!newPrice) return;
    
    try {
        const resp = await fetch(`${url}/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newName, price: parseFloat(newPrice)})
        });
        
        if (resp.ok) {
            showMessage('✅ Обновлено!');
            window.location.reload();
        } else {
            showMessage('❌ Ошибка при обновлении');
        }
    } catch (error) {
        showMessage('❌ Ошибка: ' + error.message);
    }
}

// Удалить услугу
async function deleteItem(id) {
    if (confirm('Удалить?')) {
        try {
            const resp = await fetch(`${url}/${id}`, {method: 'DELETE'});
            if (resp.ok) {
                showMessage('✅ Удалено!');
                window.location.reload();
            } else {
                showMessage('❌ Ошибка при удалении');
            }
        } catch (error) {
            showMessage('❌ Ошибка: ' + error.message);
        }
    }
}

// Показать сообщение
function showMessage(msg) {
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = msg;
    setTimeout(() => {
        messageDiv.innerHTML = '';
    }, 2000);
}