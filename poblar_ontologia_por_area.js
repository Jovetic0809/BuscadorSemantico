const readline = require('readline');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Opciones temáticas válidas y su mapeo a DBpedia
const temasValidos = {
  'Física': 'physics',
  'Matemáticas': 'mathematics',
  'Informática': 'computer science',
  'Historia': 'history',
  'Biología': 'biology',
  'Química': 'chemistry',
  'Medicina': 'medicine',
  'Astronomía': 'astronomy',
  'Ingeniería': 'engineering',
  'Literatura': 'literature'
};

// Mostrar el menú
function mostrarTemas() {
  console.log('🧠 Áreas temáticas disponibles:');
  Object.entries(temasValidos).forEach(([nombre], index) => {
    console.log(`  ${index + 1}. ${nombre}`);
  });
}

// Solicitar selección
function solicitarTema(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  mostrarTemas();
  rl.question('\n🔍 Ingrese el número del área temática deseada: ', (respuesta) => {
    const index = parseInt(respuesta.trim()) - 1;
    const claves = Object.keys(temasValidos);
    if (index >= 0 && index < claves.length) {
      const nombreArea = claves[index];
      const areaDBpedia = temasValidos[nombreArea];
      rl.close();
      callback(nombreArea, areaDBpedia);
    } else {
      console.log('❌ Número inválido. Intente de nuevo.');
      rl.close();
    }
  });
}

// Programa principal
solicitarTema(async (nombreArea, areaDBpedia) => {
  await poblarOntologia(nombreArea, areaDBpedia);
});

async function poblarOntologia(nombreArea, areaTematica) {
  const endpoint = 'https://dbpedia.org/sparql';
  const archivoOWL = 'ontologia_corregida.owl';
  const salidaOWL = 'ontologia_con_area.owl';

  const clases = [
    {
      nombre: 'Articulo',
      tipo: 'Articulo',
      propiedades: ['titulo', 'resumen', 'autor', 'fechaDePublicacion'],
      query: (tema) => `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?item ?titulo ?resumen ?fecha ?autor WHERE {
  ?item a dbo:WrittenWork ;
        rdfs:label ?titulo ;
        dbo:abstract ?resumen ;
        dbo:author ?autorURI ;
        dbo:subject ?tema ;
        dbo:publicationDate ?fecha .
  ?tema rdfs:label ?temaLabel .
  ?autorURI rdfs:label ?autor .
  FILTER (lang(?titulo) = 'es' || lang(?titulo) = 'en')
FILTER (lang(?resumen) = 'es' || lang(?resumen) = 'en')
FILTER (lang(?autor) = 'es' || lang(?autor) = 'en')
FILTER (lang(?temaLabel) = 'es' || lang(?temaLabel) = 'en')
  FILTER CONTAINS(LCASE(STR(?temaLabel)), LCASE("${tema}"))
}
LIMIT 3
`,
      mapear: (a, i) => ({
        id: `articulo${i + 1}`,
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
      query: (tema) => `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?item ?titulo ?autor ?isbn WHERE {
  ?item a dbo:Book ;
        rdfs:label ?titulo ;
        dbo:isbn ?isbn ;
        dbo:subject ?tema ;
        dbo:author ?autorURI .
  ?tema rdfs:label ?temaLabel .
  ?autorURI rdfs:label ?autor .
  FILTER (lang(?titulo) = 'es')
  FILTER (lang(?autor) = 'es')
  FILTER (lang(?temaLabel) = 'es')
  FILTER CONTAINS(LCASE(STR(?temaLabel)), LCASE("${tema}"))
}
LIMIT 3
`,
      mapear: (a, i) => ({
        id: `libro${i + 1}`,
        titulo: a.titulo.value,
        autor: a.autor.value,
        isbn: a.isbn.value
      })
    }
  ];

  function escapeXML(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
  }

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

  async function obtenerDatos(clase, area) {
    const res = await axios.get(endpoint, {
      params: {
        query: clase.query(area),
        format: 'application/sparql-results+json'
      }
    });
    return res.data.results.bindings.map(clase.mapear);
  }

  try {
    let contenido = fs.readFileSync(path.join(__dirname, archivoOWL), 'utf8');

    const cierreOntology = /<\/Ontology\s*>/i;
    if (!cierreOntology.test(contenido)) {
      throw new Error('El archivo OWL no contiene la etiqueta </Ontology>.');
    }

    let todoElFragmento = '';

    for (const clase of clases) {
      console.log(`🔍 Obteniendo datos para ${clase.nombre} en el área "${nombreArea}"...`);
      const instancias = await obtenerDatos(clase, areaTematica);
      const fragmento = crearFragmentosOWL(clase, instancias);
      todoElFragmento += `\n  <!-- Instancias de ${clase.nombre} - área: ${nombreArea} -->\n${fragmento}\n`;
    }

    const nuevoContenido = contenido.replace(cierreOntology, `${todoElFragmento}</Ontology>`);
    fs.writeFileSync(path.join(__dirname, salidaOWL), nuevoContenido, 'utf8');
    console.log(`✅ Ontología poblada exitosamente para el área "${nombreArea}".`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}
