// lang.js
const traducciones = {
  es: {
    titulo: "Buscador Ontológico",
    placeholder: "Escribe tu búsqueda...",
    btnBuscar: "Buscar",
    verMas: "Ver más",
    volver: "← Volver al buscador"
  },
  en: {
    titulo: "Ontology Search Engine",
    placeholder: "Type your search...",
    btnBuscar: "Search",
    verMas: "See more",
    volver: "← Back to search"
  },
  pt: {
    titulo: "Motor de Busca Ontológico",
    placeholder: "Digite sua busca...",
    btnBuscar: "Buscar",
    verMas: "Ver mais",
    volver: "← Voltar para a busca"
  }
};

let idiomaActual = 'es';

function cambiarIdioma() {
  idiomaActual = document.getElementById('idiomaSelect').value;
  const t = traducciones[idiomaActual];
  document.getElementById('titulo').textContent = t.titulo;
  document.getElementById('searchInput').placeholder = t.placeholder;
  document.getElementById('btnBuscar').textContent = t.btnBuscar;
}
