const axios = require('axios');
const fs = require('fs');
const path = require('path');

const endpoint = 'https://dbpedia.org/sparql';
const query = `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?articulo ?titulo ?resumen ?fecha ?autor WHERE {
  ?articulo a dbo:WrittenWork ;
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
`;

const archivoOWL = 'ontologia_corregida.owl';

async function poblarConArticulos() {
  try {
    const res = await axios.get(endpoint, {
      params: {
        query,
        format: 'application/sparql-results+json'
      }
    });

    const articulos = res.data.results.bindings.map((a, i) => ({
      id: `articuloDB${i + 1}`,
      titulo: a.titulo.value.replace(/&/g, '&amp;'),
      resumen: a.resumen.value.replace(/&/g, '&amp;'),
      autor: a.autor.value.replace(/&/g, '&amp;'),
      fecha: a.fecha.value
    }));

    const fragmentos = articulos.map(a => `
  <owl:NamedIndividual rdf:about="#${a.id}">
    <rdf:type rdf:resource="#Articulo"/>
  </owl:NamedIndividual>

  <owl:DataPropertyAssertion>
    <owl:DataProperty IRI="#titulo"/>
    <owl:NamedIndividual IRI="#${a.id}"/>
    <rdf:Literal>${a.titulo}</rdf:Literal>
  </owl:DataPropertyAssertion>

  <owl:DataPropertyAssertion>
    <owl:DataProperty IRI="#resumen"/>
    <owl:NamedIndividual IRI="#${a.id}"/>
    <rdf:Literal>${a.resumen}</rdf:Literal>
  </owl:DataPropertyAssertion>

  <owl:DataPropertyAssertion>
    <owl:DataProperty IRI="#autor"/>
    <owl:NamedIndividual IRI="#${a.id}"/>
    <rdf:Literal>${a.autor}</rdf:Literal>
  </owl:DataPropertyAssertion>

  <owl:DataPropertyAssertion>
    <owl:DataProperty IRI="#fechaDePublicacion"/>
    <owl:NamedIndividual IRI="#${a.id}"/>
    <rdf:Literal rdf:datatype="http://www.w3.org/2001/XMLSchema#date">${a.fecha}</rdf:Literal>
  </owl:DataPropertyAssertion>
`).join('\n');

    const owlPath = path.join(__dirname, archivoOWL);
    let contenido = fs.readFileSync(owlPath, 'utf8');

    const cierreOntology = /<\/Ontology\s*>/i;
    if (!cierreOntology.test(contenido)) {
      throw new Error('El archivo OWL no contiene la etiqueta </Ontology>. No se puede insertar.');
    }

    const nuevoContenido = contenido.replace(cierreOntology, `  <!-- Artículos agregados automáticamente -->\n${fragmentos}\n</Ontology>`);

    const nuevoPath = path.join(__dirname, 'ontologia_con_articulos.owl');
    fs.writeFileSync(nuevoPath, nuevoContenido, 'utf8');

    console.log('✅ Artículos agregados exitosamente antes de </Ontology>.');
  } catch (err) {
    console.error('❌ Error al poblar la ontología:', err.message);
  }
}

poblarConArticulos();
