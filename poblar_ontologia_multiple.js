const axios = require('axios');
const fs = require('fs');
const path = require('path');

const endpoint = 'https://dbpedia.org/sparql';
const archivoOWL = 'ontologia_corregida.owl';
const salidaOWL = 'ontologia_con_clases.owl';

// --- DEFINICIÓN DE CLASES Y SUS CONSULTAS SPARQL ---
const clases = [
  {
    nombre: 'Articulo',
    tipo: 'Articulo',
    propiedades: ['titulo', 'resumen', 'autor', 'fechaDePublicacion'],
    query: `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?item ?titulo ?resumen ?fecha ?autor WHERE {
  ?item a dbo:WrittenWork ;
        rdfs:label ?titulo ;
        dbo:abstract ?resumen ;
        dbo:author ?autorURI ;
        dbo:publicationDate ?fecha .
  ?autorURI rdfs:label ?autor .
  FILTER (lang(?titulo) = 'es')
  FILTER (lang(?resumen) = 'es')
  FILTER (lang(?autor) = 'es')
}
LIMIT 3
`,
    mapear: (a, i) => ({
      id: `articuloDB${i + 1}`,
      titulo: a.titulo.value,
      resumen: a.resumen.value,
      autor: a.autor.value,
      fechaDePublicacion: a.fecha.value
    })
  },
  {
    nombre: 'Libro',
    tipo: 'Libro',
    propiedades: ['titulo', 'autor', 'isbn'],
    query: `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?item ?titulo ?autor ?isbn WHERE {
  ?item a dbo:Book ;
        rdfs:label ?titulo ;
        dbo:isbn ?isbn ;
        dbo:author ?autorURI .
  ?autorURI rdfs:label ?autor .
  FILTER (lang(?titulo) = 'es')
  FILTER (lang(?autor) = 'es')
}
LIMIT 3
`,
    mapear: (a, i) => ({
      id: `libroDB${i + 1}`,
      titulo: a.titulo.value,
      autor: a.autor.value,
      isbn: a.isbn.value
    })
  }
];
// --- FUNCIÓN PARA OBTENER DATOS DE CADA CLASE ---
async function obtenerDatos(clase) {
    const res = await axios.get(endpoint, {
      params: {
        query: clase.query,
        format: 'application/sparql-results+json'
      }
    });
    return res.data.results.bindings.map(clase.mapear);
  }
  
  // --- FUNCIÓN PARA CREAR FRAGMENTOS OWL ---
  function crearFragmentosOWL(clase, instancias) {
    return instancias.map(inst => {
      const individuo = `
    <owl:NamedIndividual rdf:about="#${inst.id}">
      <rdf:type rdf:resource="#${clase.tipo}"/>
    </owl:NamedIndividual>`;
  
      const propiedades = clase.propiedades.map(prop => {
        const valor = inst[prop];
        if (!valor) return '';
        const esFecha = prop.toLowerCase().includes('fecha');
        return `
    <owl:DataPropertyAssertion>
      <owl:DataProperty IRI="#${prop}"/>
      <owl:NamedIndividual IRI="#${inst.id}"/>
      <rdf:Literal${esFecha ? ' rdf:datatype="http://www.w3.org/2001/XMLSchema#date"' : ''}>${escapeXML(valor)}</rdf:Literal>
    </owl:DataPropertyAssertion>`;
      }).join('\n');
  
      return `${individuo}\n${propiedades}`;
    }).join('\n');
  }
  
  // --- ESCAPAR CARACTERES ESPECIALES XML ---
  function escapeXML(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
  }
  
  // --- FUNCIÓN PRINCIPAL ---
  async function poblarOntologia() {
    try {
      let contenido = fs.readFileSync(path.join(__dirname, archivoOWL), 'utf8');
  
      const cierreOntology = /<\/Ontology\s*>/i;
      if (!cierreOntology.test(contenido)) {
        throw new Error('El archivo OWL no contiene la etiqueta </Ontology>.');
      }
  
      let todoElFragmento = '';
  
      for (const clase of clases) {
        console.log(`🔍 Obteniendo datos para ${clase.nombre}...`);
        const instancias = await obtenerDatos(clase);
        const fragmento = crearFragmentosOWL(clase, instancias);
        todoElFragmento += `\n  <!-- Instancias de ${clase.nombre} -->\n${fragmento}\n`;
      }
  
      const nuevoContenido = contenido.replace(cierreOntology, `${todoElFragmento}</Ontology>`);
      fs.writeFileSync(path.join(__dirname, salidaOWL), nuevoContenido, 'utf8');
      console.log('✅ Ontología poblada exitosamente con múltiples clases.');
  
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }
  
  poblarOntologia();
  