const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const axios = require('axios');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

let index = [];
let rawOntology = null;

// Extrae texto útil para el índice
function extractTextFromNode(node) {
  let texts = [];

  if (typeof node === 'string') {
    if (node.length > 3) texts.push(node);
  }

  if (typeof node === 'object') {
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(child => texts = texts.concat(extractTextFromNode(child)));
      } else if (typeof value === 'object') {
        texts = texts.concat(extractTextFromNode(value));
      } else if (typeof value === 'string') {
        if (value.length > 3) texts.push(value);
      }
    }

    if (node.$) {
      for (const attr in node.$) {
        const attrVal = node.$[attr];
        if (typeof attrVal === 'string' && attrVal.length > 3) {
          texts.push(attrVal);
        }
      }
    }
  }

  return texts;
}

// Carga y parsea la ontología
function loadOntology() {
  const xml = fs.readFileSync('ontologia_con_clases.owl', 'utf-8');
  xml2js.parseString(xml, { tagNameProcessors: [xml2js.processors.stripPrefix] }, (err, result) => {
    if (err) {
      console.error('Error al parsear la ontología:', err);
      return;
    }

    rawOntology = result;

    // Debug: ver estructura
    const root = Object.values(rawOntology)[0];
    console.log('\n🔍 Claves dentro del nodo raíz:\n', Object.keys(root || {}));

    const dpa = root?.['DataPropertyAssertion'];
    if (dpa) {
      console.log('\n✅ Se encontró DataPropertyAssertion, ejemplo:\n', JSON.stringify(dpa.slice(0, 2), null, 2));
    } else {
      console.log('\n⚠️ No se encontró DataPropertyAssertion dentro del nodo raíz.\n');
    }

    const allTexts = extractTextFromNode(result);
    index = Array.from(new Set(allTexts));
    console.log(`Índice construido con ${index.length} elementos.`);
    console.log(index.slice(0, 10));
  });
}

loadOntology();

// Ruta: búsqueda simple por texto
app.get('/buscar', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Consulta demasiado corta o vacía.' });
  }

  const results = index.filter(item => item.toLowerCase().includes(query));
  res.json({ resultados: results });
});

// Ruta: obtener propiedades de una instancia
app.get('/articulo/:id', (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'ID inválido.' });

  const root = Object.values(rawOntology)[0];
  const dataAssertions = root?.['DataPropertyAssertion'] || [];

  const properties = {};

  dataAssertions.forEach(assertion => {
    const dataPropNode = assertion['DataProperty']?.[0];
    const namedIndNode = assertion['NamedIndividual']?.[0];
    const literalNode = assertion['Literal']?.[0];

    const propIRI = dataPropNode?.$?.IRI;
    const indivIRI = namedIndNode?.$?.IRI;

    if (indivIRI?.endsWith(`#${id}`) && propIRI && literalNode) {
      const key = propIRI.replace(/^.*#/, ''); // solo el nombre
      const value = typeof literalNode === 'string' ? literalNode : literalNode._ || '';
      properties[key] = value;
    }
  });

  if (Object.keys(properties).length === 0) {
    return res.status(404).json({ error: `No se encontró información para ${id}` });
  }

  res.json({ id: `#${id}`, propiedades: properties });
});

app.get('/instancia/:id', (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
  
    const root = Object.values(rawOntology)[0];
    const dataAssertions = root?.['DataPropertyAssertion'] || [];
  
    const properties = {};
  
    dataAssertions.forEach(assertion => {
      const dataPropNode = assertion['DataProperty']?.[0];
      const namedIndNode = assertion['NamedIndividual']?.[0];
      const literalNode = assertion['Literal']?.[0];
  
      const propIRI = dataPropNode?.$?.IRI;
      const indivIRI = namedIndNode?.$?.IRI;
  
      if (indivIRI?.endsWith(`#${id}`) && propIRI && literalNode) {
        const key = propIRI.replace(/^.*#/, '');
        const value = typeof literalNode === 'string' ? literalNode : literalNode._ || '';
        properties[key] = value;
      }
    });
  
    if (Object.keys(properties).length === 0) {
      return res.status(404).json({ error: `No se encontró información para ${id}` });
    }
  
    res.json({ id: `#${id}`, propiedades: properties });
  });
  
  app.get('/dbpedia/:query', async (req, res) => {
    const queryParam = req.params.query;
  
    // Construir la consulta SPARQL
    const sparqlQuery = `
      SELECT ?abstract ?thumbnail WHERE {
        dbr:${queryParam} dbo:abstract ?abstract .
        OPTIONAL { dbr:${queryParam} dbo:thumbnail ?thumbnail . }
        FILTER (lang(?abstract) = 'es')
      } LIMIT 1
    `;
  
    try {
      const response = await axios.get('https://dbpedia.org/sparql', {
        params: {
          query: sparqlQuery,
          format: 'json'
        }
      });
  
      const bindings = response.data.results.bindings;
  
      if (bindings.length === 0) {
        return res.status(404).json({ error: 'No se encontró información en DBpedia.' });
      }
  
      const abstract = bindings[0].abstract.value;
      const thumbnail = bindings[0].thumbnail?.value;
  
      res.json({ resumen: abstract, imagen: thumbnail || null });
  
    } catch (error) {
      console.error('Error consultando DBpedia:', error.message);
      res.status(500).json({ error: 'Fallo al consultar DBpedia.' });
    }
  });

  app.get('/buscar-con-id', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Consulta demasiado corta o vacía.' });
  }

  const root = Object.values(rawOntology)[0];
  const dataAssertions = root?.['DataPropertyAssertion'] || [];

  const resultados = [];

  dataAssertions.forEach(assertion => {
    const namedIndNode = assertion['NamedIndividual']?.[0];
    const literalNode = assertion['Literal']?.[0];

    const indivIRI = namedIndNode?.$?.IRI;
    const id = indivIRI?.split('#')[1];
    const texto = typeof literalNode === 'string' ? literalNode : literalNode?._;

    if (id && texto && texto.toLowerCase().includes(query)) {
      resultados.push({ texto, id });
    }
  });

  if (resultados.length === 0) {
    return res.status(404).json({ resultados: [], mensaje: 'No se encontraron coincidencias.' });
  }

  res.json({ resultados });
});


// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
