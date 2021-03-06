import { get } from '@ember/object';
import Service from '@ember/service';
import EmberObject from '@ember/object';
import { task } from 'ember-concurrency';
import { isArray } from '@ember/array';
import { warn } from '@ember/debug';
import { inject as service } from '@ember/service';

/**
 * Service responsible for correct annotation of dates
 *
 * @module editor-scoped-bestuursorgaan-plugin
 * @class RdfaEditorScopedBestuursorgaanPlugin
 * @constructor
 * @extends EmberService
 */
const RdfaEditorScopedBestuursorgaanPlugin = Service.extend({
  overwriteScopedOrgaan: 'http://data.vlaanderen.be/ns/besluit#Bestuursorgaan',
  insertScopedOrgaan: 'http://mu.semte.ch/vocabularies/ext/scopedBestuursorgaanText',
  insertStandAloneBestuurseenheid: 'http://mu.semte.ch/vocabularies/ext/setStandAloneCurrentBestuurseenheid',

  scopedOrgaan: 'editor-plugins/scoped-bestuursorgaan-card',
  overwriteCard: 'editor-plugins/scoped-bestuursorgaan-overwrite-card',

  currentSession: service(),

  allowedBestuursorgaanClassifications: [  //eslint-disable-line ember/avoid-leaking-state-in-ember-objects
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e000005", //	"Gemeenteraad"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e000007", //	"Raad voor Maatschappelijk Welzijn"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e000009", //	"Bijzonder Comité voor de Sociale Dienst"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e00000a", //	"Districtsraad"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e00000c", //	"Provincieraad"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/53c0d8cd-f3a2-411d-bece-4bd83ae2bbc9", //	"Voorzitter van het Bijzonder Comité voor de Sociale Dienst"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/9314533e-891f-4d84-a492-0338af104065", //	"Districtsburgemeester"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e00000b", //	"Districtscollege"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/180a2fba-6ca9-4766-9b94-82006bb9c709", //	"Gouverneur"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/e14fe683-e061-44a2-b7c8-e10cab4e6ed9", //	"Voorzitter van de Raad voor Maatschappelijk Welzijn"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e000006", //	"College van Burgemeester en Schepenen"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/4c38734d-2cc1-4d33-b792-0bd493ae9fc2", //	"Voorzitter van de Gemeenteraad"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e00000d", //	"Deputatie"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/4955bd72cd0e4eb895fdbfab08da0284", //	"Burgemeester"
  "http://data.vlaanderen.be/id/concept/BestuursorgaanClassificatieCode/5ab0e9b8a3b2ca7c5e000008" //	"Vast Bureau"
  ],

  /**
   * Restartable task to handle:
   *  a. auto insert current bestuurseenheid based on RDFA instructive..
   *  b. set a hint around a node which contains property with type bestuursorgaan
   *  c. based on RDFA instructive, set a hint to select a bestuursorgaan
   * ---------------------------------------------------
   * CODE REVIEW NOTES
   * ---------------------------------------------------
   *
   *  INTERACTION PATTERNS
   *  --------------------
   *  For a. :
   *   - checks if rdfa instructive is met. Replace node attached to richNode with current bestuurseenheid.
   *
   *   For b. :
   *   - checks if there is a node with property with domain Bestuursorgaan. Inserts invisible hint on textual content.
   *     On reselect or insert card, the node is replaced with updated content.
   *
   *   For c. :
   *  - checks if there an instructive to add a bestuursorgaan (in tijd). Highlights the text, the parent node is passed to the card.
   *    On insert the parent node is replaced with wanted content.
   *
   *  POTENTIAL ISSUES/TODO
   *  ---------------------
   *  -  Replacing domNodes not attached to the tree anymore (problem for a. and c.)
   *     TODO: a robust handling and decent fallback if dead node is found.
   *           This is potentially (as a POC) mitigated in flow b.
   *
   *  - Instructives could pollute RDFA content. e.g. <span property="aRealProperty:foo"><property="ext:instructive"> test </span></span>
   *    The resource will result in {subject, predicate: "aRealProperty:foo", object: "test"}
   *     TODO: implement more expressive instructives wich DO NOT set aRealProperty
   *
   *
   *
   *  OTHER INFO
   *  ----------
   *  - uses metamodel plugin utils to:
   *      1.  check wich property the bestuursorgaan to insert belongs to.
   *      2.  (as premature optimisation, so get rid of this) Some rdfa serialization utils of the bestuursorgaan to insert.
   * ---------------------------------------------------
   * END CODE REVIEW NOTES
   * ---------------------------------------------------
   * @method execute
   *
   * @param {string} hrId Unique identifier of the event in the hintsRegistry
   * @param {Array} contexts RDFa contexts of the text snippets the event applies on
   * @param {Object} hintsRegistry Registry of hints in the editor
   * @param {Object} editor The RDFa editor instance
   *
   * @public
   */
  execute: task(function * (hrId, contexts, hintsRegistry, editor) {
    if (contexts.length === 0) return [];
    let cardName;

    let bestuurseenheid = yield this.currentSession.get('group');

    contexts.forEach( (context) => {
      // clear previous hints
      hintsRegistry.removeHintsInRegion(context.region, hrId, this.scopedOrgaan);
      hintsRegistry.removeHintsInRegion(context.region, hrId, this.overwriteCard);
    });

    for (let context of contexts) {
      // add new hints
      const triple = this.detectRelevantContext(context);
      if (triple) {
        const selectContext = { property: triple.predicate };
        if(triple.predicate === this.insertStandAloneBestuurseenheid){
          const selection = editor.selectContext(context.region, selectContext);
          editor.update(selection, {
            remove: { property: this.insertStandAloneBestuurseenheid},
            set: {
              typeof: "besluit:Bestuurseenheid",
              resource: bestuurseenheid.uri,
              innerHTML: `${bestuurseenheid.naam}`
            }
          });
        }
        else if(triple.predicate === this.insertScopedOrgaan){
          cardName = this.scopedOrgaan;
          hintsRegistry.removeHintsInRegion(context.region, hrId, cardName);
          let newCards =
              this
              .generateHintsForContext(context, triple, selectContext)
              .map( (hint) => this.generateCard( hrId, hintsRegistry, editor, hint, cardName ) );
          hintsRegistry.addHints(hrId, cardName, newCards);
        }
        else if(triple.object === this.overwriteScopedOrgaan){
          // the overwriteScopedOrgaan context is always wrapped by insertScopedOrgaan context.
          cardName = this.overwriteCard;
          hintsRegistry.removeHintsInRegion(context.region, hrId, cardName);
          let newCards =
              this
              .generateHintsForContext(context, triple, selectContext, { noHighlight: true })
              .map( (hint) => this.generateCard( hrId, hintsRegistry, editor, hint, cardName ) );
          hintsRegistry.addHints(hrId, cardName, newCards);
        }
      }
    }
  }),

  /**
   * Given context object, tries to detect a context the plugin can work on
   *
   * @method detectRelevantContext
   *
   * @param {Object} context Text snippet at a specific location with an RDFa context
   *
   * @return {String} URI of context if found, else empty string.
   *
   * @private
   */
  detectRelevantContext(context){
    if(context.context.slice(-1)[0].predicate == this.insertScopedOrgaan){
      return context.context.slice(-1)[0];
    }
    if(context.context.slice(-1)[0].predicate == this.insertStandAloneBestuurseenheid){
      return context.context.slice(-1)[0];
    }
    if(context.context.slice(-1)[0].predicate == 'a' && context.context.slice(-1)[0].object == this.overwriteScopedOrgaan){
      return context.context.slice(-1)[0];
    }
    return null;
  },

  /**
   * Find the first resource type the rdfa instructive belongs to.
   * e.g.: in example below will return besluit:Zitting
   * <div typeof="besluit:Zitting" resource="http://uri">
   *   <h2 property="dc:title">
   *     <span property="ext:scopedBestuursorgaanText">selecteer bestuursorgaan</span>
   *   </h2>
   * </div>
   * @private
   */
  findTypeForInstructive(context, instructiveTriple){
    return (context.context.find(t => t.subject == instructiveTriple.subject && t.predicate == 'a') || {}).object;
  },

  /**
   * Generates a card given a hint
   *
   * @method generateCard
   *
   * @param {string} hrId Unique identifier of the event in the hintsRegistry
   * @param {Object} hintsRegistry Registry of hints in the editor
   * @param {Object} editor The RDFa editor instance
   * @param {Object} hint containing the hinted string and the location of this string
   *
   * @return {Object} The card to hint for a given template
   *
   * @private
   */
  generateCard(hrId, hintsRegistry, editor, hint, cardName, label = 'Voeg het relevante bestuursorgaan toe.' ){
    return EmberObject.create({
      info: {
        label: label,
        plainValue: hint.text,
        location: hint.location,
        domainUri: hint.domainUri,
        context: hint.selectContext,
        instructiveUri: hint.instructiveUri,
        huidigBestuursorgaanInTijd: hint.huidigBestuursorgaanInTijd,
        hrId, hintsRegistry, editor
      },
      location: hint.location,
      options: hint.options,
      card: cardName
    });
  },

  /**
   * Generates a hint, given a context
   *
   * @method generateHintsForContext
   *
   * @param {Object} context Text snippet at a specific location with an RDFa context
   *
   * @return {Object} [{dateString, location}]
   *
   * @private
   */
  generateHintsForContext(context, instructiveTriple, selectContext, options = {}){
    const domainUri = this.findTypeForInstructive(context, instructiveTriple);
    const hints = [];
    const text = context.text ?  context.text : "";
    const location = context.region;
    const huidigBestuursorgaanInTijd = instructiveTriple.subject;
    hints.push({text, location, domainUri, selectContext, huidigBestuursorgaanInTijd, instructiveUri: instructiveTriple.predicate, options});
    return hints;
  }
});

export default RdfaEditorScopedBestuursorgaanPlugin;
