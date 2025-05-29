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
        resultadosDiv.innerHTML = `<p>${traducciones[idiomaActual].errorCorto || "Escribe al menos 2 caracteres."}</p>`;
        return;
    }

    try {
        const res = await fetch(`http://localhost:3001/buscar-con-id?q=${query}`);
        const data = await res.json();

        if (data.resultados.length === 0) {
            resultadosDiv.innerHTML = `<p>${traducciones[idiomaActual].noResultados || "No se encontraron resultados."}</p>`;
            return;
        }

        data.resultados.forEach(item => {
            const card = document.createElement('div');
            card.className = 'resultado-card';

            const textoCorto = limitarPalabras(item.texto, 20);

            const texto = document.createElement('p');
            texto.textContent = textoCorto;

            const boton = document.createElement('button');
            boton.textContent = traducciones[idiomaActual].verMas || "Ver más";
            boton.className = 'btn';
            boton.onclick = () => {
                window.location.href = `detalle.html?id=${item.id}&lang=${idiomaActual}`;
            };

            card.appendChild(texto);
            card.appendChild(boton);
            resultadosDiv.appendChild(card);
        });

    } catch (err) {
        console.error('Error al buscar:', err);
        resultadosDiv.innerHTML = `<p>${traducciones[idiomaActual].errorBuscar || "Error al buscar los datos."}</p>`;
    }
}
function cambiarIdioma(idioma) {
    idiomaActual = idioma;
    localStorage.setItem('idiomaActual', idioma);
    actualizarTexto();

    // Marcar botón activo
    document.querySelectorAll('.idioma-btn').forEach(btn => {
        btn.classList.remove('activo');
    });
    document.querySelector(`.idioma-btn[onclick*="${idioma}"]`).classList.add('activo');
}

function actualizarTexto() {
    const t = traducciones[idiomaActual];
    document.getElementById('titulo').textContent = t.titulo || "Buscador Ontológico";
    document.getElementById('searchInput').placeholder = t.placeholder || "Escribe tu búsqueda...";
    document.getElementById('btnBuscar').textContent = t.btnBuscar  || "Buscar";
}

// Inicializar idioma actual desde localStorage
window.onload = () => {
    const guardado = localStorage.getItem('idiomaActual');
    if (guardado) idiomaActual = guardado;
    cambiarIdioma(idiomaActual || 'es');
};
