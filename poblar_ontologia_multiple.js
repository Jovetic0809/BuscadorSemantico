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
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?item (SAMPLE(?titulo) AS ?titulo_unico) (SAMPLE(?autor) AS ?autor_unico)
       (SAMPLE(?resumen) AS ?resumen_unico) (SAMPLE(?fecha) AS ?fecha_unica)
WHERE {
  ?item a dbo:WrittenWork ;
        rdfs:label ?titulo ;
        dbo:author ?autorURI ;
        dct:subject ?categoria .
  OPTIONAL { ?item dbo:abstract ?resumen FILTER (lang(?resumen) = "en") }
  OPTIONAL { ?item dbo:date ?fecha }
  ?autorURI rdfs:label ?autor .
  ?categoria rdfs:label ?nombreCategoria .
  FILTER(CONTAINS(LCASE(STR(?nombreCategoria)), "computer science"))
}
GROUP BY ?item
LIMIT 10
`,
    mapear: (a, i) => ({
      id: `articuloDB${i + 1}`,
      titulo: a.titulo_unico.value,
      resumen: a.resumen_unico?.value || "No disponible",
      autor: a.autor_unico.value,
      fechaDePublicacion: a.fecha_unica?.value || "No disponible"
    })
  },
  {
    nombre: 'Libro',
    tipo: 'Libro',
    propiedades: ['titulo', 'autor', 'isbn'],
    query: `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?item (SAMPLE(?titulo) AS ?titulo_unico) (SAMPLE(?autor) AS ?autor_unico) (SAMPLE(?isbn) AS ?isbn_unico) WHERE {
  ?item a dbo:Book ;
        rdfs:label ?titulo ;
        dbo:author ?autorURI ;
        dct:subject ?categoria .
  OPTIONAL { ?item dbo:isbn ?isbn }
  ?autorURI rdfs:label ?autor .
  ?categoria rdfs:label ?nombreCategoria .
  FILTER(CONTAINS(LCASE(STR(?nombreCategoria)), "computer science"))
}
GROUP BY ?item
LIMIT 10
`,
    mapear: (a, i) => ({
      id: `libroDB${i + 1}`,
      titulo: a.titulo_unico.value,
      autor: a.autor_unico.value,
      isbn: a.isbn_unico?.value || "No disponible"
    })
  },
  {
    nombre: 'Video',
    tipo: 'Video',
    propiedades: ['titulo', 'descripcion'],
    query: `
PREFIX dbo: <http://dbpedia.org/ontology/> 
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?item (SAMPLE(?titulo) AS ?titulo_unico) (SAMPLE(?descripcion) AS ?descripcion_unica) WHERE {
  {
    ?item a dbo:Work .
  }

  ?item rdfs:label ?titulo .
  OPTIONAL { ?item dbo:abstract ?descripcion }
  ?item dct:subject ?categoria .
  ?categoria rdfs:label ?nombreCategoria .

  FILTER(LANG(?titulo) = "en")
  FILTER(LANG(?nombreCategoria) = "en")
  FILTER(
    CONTAINS(LCASE(STR(?nombreCategoria)), "computer") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "software") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "technology") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "computing") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "artificial intelligence") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "machine learning") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "data")
  )
}
GROUP BY ?item
LIMIT 10
`,
    mapear: (a, i) => ({
      id: `videoDB${i + 1}`,
      titulo: a.titulo_unico.value,
      descripcion: a.descripcion_unica?.value || "No disponible"
    })
  },
  {
    nombre: 'Audio',
    tipo: 'Audio',
    propiedades: ['titulo', 'descripcion'],
    query: `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?item (SAMPLE(?titulo) AS ?titulo_unico) (SAMPLE(?descripcion) AS ?descripcion_unica) WHERE {
  {
    ?item a dbo:MusicalWork .
  } UNION {
    ?item a dbo:Sound .
  } UNION {
    ?item a dbo:Work .
  }

  ?item rdfs:label ?titulo .
  OPTIONAL { ?item dbo:abstract ?descripcion }
  ?item dct:subject ?categoria .
  ?categoria rdfs:label ?nombreCategoria .

  FILTER(LANG(?titulo) = "en")
  FILTER(LANG(?nombreCategoria) = "en")
  FILTER(
    CONTAINS(LCASE(STR(?nombreCategoria)), "computer") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "software") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "technology") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "computing") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "artificial intelligence") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "machine learning") ||
    CONTAINS(LCASE(STR(?nombreCategoria)), "data")
  )
}
GROUP BY ?item
LIMIT 10
`,
    mapear: (a, i) => ({
      id: `audioDB${i + 1}`,
      titulo: a.titulo_unico.value,
      descripcion: a.descripcion_unica?.value || "No disponible"
    })
  }
];

// --- FUNCIÓN PARA OBTENER DATOS DE CADA CLASE ---
async function obtenerDatos(clase) {
  try {
    console.log(`🔍 Obteniendo datos para ${clase.nombre}...`);
    const res = await axios.get(endpoint, {
      params: {
        query: clase.query,
        format: 'application/sparql-results+json'
      },
      timeout: 50000 // 10 segundos de timeout
    });

    if (!res.data.results.bindings) {
      console.warn(`⚠️ No se encontraron resultados para ${clase.nombre}`);
      return [];
    }
    return res.data.results.bindings.map(clase.mapear);
  } catch (err) {
    console.error(`❌ Error al obtener datos para ${clase.nombre}:`, err.message);
    return [];
  }
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
      if (!valor || valor === "No disponible") return '';
      const esFecha = prop.toLowerCase().includes('fecha');
      return `
    <owl:DataPropertyAssertion>
      <owl:DataProperty IRI="#${prop}"/>
      <owl:NamedIndividual IRI="#${inst.id}"/>
      <rdf:Literal${esFecha ? ' rdf:datatype="http://www.w3.org/2001/XMLSchema#date"' : ''}>${escapeXML(valor)}</rdf:Literal>
    </owl:DataPropertyAssertion>`;
    }).filter(Boolean).join('\n');

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
    console.log('🏗️ Iniciando población de ontología...');
    
    let contenido = fs.readFileSync(path.join(__dirname, archivoOWL), 'utf8');

    const cierreOntology = /<\/Ontology\s*>/i;
    if (!cierreOntology.test(contenido)) {
      throw new Error('El archivo OWL no contiene la etiqueta </Ontology>.');
    }

    let todoElFragmento = '';

    for (const clase of clases) {
      const instancias = await obtenerDatos(clase);
      
      if (!instancias || instancias.length === 0) {
        console.warn(`⚠️ No se encontraron instancias para ${clase.nombre}`);
        continue;
      }

      const fragmento = crearFragmentosOWL(clase, instancias);
      todoElFragmento += `\n  <!-- Instancias de ${clase.nombre} -->\n${fragmento}\n`;
      console.log(`✅ ${instancias.length} instancias de ${clase.nombre} procesadas`);
    }

    const nuevoContenido = contenido.replace(cierreOntology, `${todoElFragmento}</Ontology>`);
    fs.writeFileSync(path.join(__dirname, salidaOWL), nuevoContenido, 'utf8');
    console.log('🎉 Ontología poblada exitosamente con múltiples clases.');

  } catch (err) {
    console.error('❌ Error crítico:', err.message);
    process.exit(1);
  }
}

// --- EJECUCIÓN ---
poblarOntologia();