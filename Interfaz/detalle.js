function getIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function cargarDetalle() {
  const id = getIdFromUrl();
  const contenedor = document.getElementById('detalle');

  try {
    const res = await fetch(`http://localhost:3001/instancia/${id}`);
    const data = await res.json();
    const propiedades = data.propiedades;

    let html = '<ul>';
    for (const [clave, valor] of Object.entries(propiedades)) {
      html += `<li><strong>${clave}:</strong> ${valor}</li>`;
    }
    html += '</ul>';

    contenedor.innerHTML = html;
  } catch (err) {
    contenedor.innerHTML = '<p>Error al cargar el detalle.</p>';
    console.error(err);
  }
}

cargarDetalle();
