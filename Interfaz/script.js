function limitarPalabras(texto, limite) {
    const palabras = texto.split(' ');
    if (palabras.length > limite) {
        return palabras.slice(0, limite).join(' ') + '...';
    }
    return texto;
}

async function buscar() {
    const query = document.getElementById('searchInput').value;
    const resultadosDiv = document.getElementById('resultados');
    resultadosDiv.innerHTML = '';

    if (query.length < 2) {
        resultadosDiv.innerHTML = '<p>Escribe al menos 2 caracteres.</p>';
        return;
    }

    try {
        const res = await fetch(`http://localhost:3001/buscar-con-id?q=${query}`);
        const data = await res.json();

        if (data.resultados.length === 0) {
            resultadosDiv.innerHTML = '<p>No se encontraron resultados.</p>';
            return;
        }

        data.resultados.forEach(item => {
            const card = document.createElement('div');
            card.className = 'resultado-card';

            const textoCorto = limitarPalabras(item.texto, 20); // límite de 20 palabras

            const texto = document.createElement('p');
            texto.textContent = textoCorto;

            const boton = document.createElement('button');
            boton.textContent = 'Ver más';
            boton.className = 'btn';
            boton.onclick = () => {
                window.location.href = `detalle.html?id=${item.id}`;
            };

            card.appendChild(texto);
            card.appendChild(boton);
            resultadosDiv.appendChild(card);
        });

    } catch (err) {
        console.error('Error al buscar:', err);
        resultadosDiv.innerHTML = '<p>Error al buscar los datos.</p>';
    }
}
