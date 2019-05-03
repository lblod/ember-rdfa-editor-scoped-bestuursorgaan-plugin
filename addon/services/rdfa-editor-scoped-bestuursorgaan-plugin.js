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
   *  - Reconsider the restartable task
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

    contexts.forEach( (context) => {
      // add new hints
      let triple = this.detectRelevantContext(context);
      if (!triple)
        return;

      if(triple.predicate === this.insertStandAloneBestuurseenheid){
        let domNode = this.findDomNodeForContext(editor, context, this.domNodeMatchesRdfaInstructive(triple));
        if(!domNode) return;
        editor.replaceNodeWithHTML(
          domNode,
          `<span typeOf=besluit:Bestuurseenheid resource=${bestuurseenheid.uri}>
             ${bestuurseenheid.naam}
           </span>`);
      } else {
        if(triple.predicate === this.insertScopedOrgaan){
          let domNode = this.findDomNodeForContext(editor, context, this.domNodeMatchesRdfaInstructive(triple));
          if(!domNode) return;
          cardName = this.scopedOrgaan;
          hintsRegistry.removeHintsInRegion(context.region, hrId, cardName);
          let newCards =
              this
              .generateHintsForContext(context, triple, domNode)
              .map( (hint) => this.generateCard( hrId, hintsRegistry, editor, hint, cardName, 'Bestuursorgaan from insert' ) );
          hintsRegistry.addHints(hrId, cardName, newCards);
        }

        if(triple.object === this.overwriteScopedOrgaan){
          // the overwriteScopedOrgaan context is always wrapped by insertScopedOrgaan context.
          let nodeToReplace = this.findDomNodeForContext(editor, context, this.conditionDomNodeIsTypeof(this.overwriteScopedOrgaan));
          cardName = this.overwriteCard;
          hintsRegistry.removeHintsInRegion(context.region, hrId, cardName);
          let newCards =
              this
              .generateHintsForContext(context, triple, nodeToReplace, { noHighlight: true })
              .map( (hint) => this.generateCard( hrId, hintsRegistry, editor, hint, cardName, 'Bestuursorgaan from overwrite' ) );
          hintsRegistry.addHints(hrId, cardName, newCards);
        }
      }
    } );
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
        domNodeToUpdate: hint.domNode,
        instructiveUri: hint.instructiveUri,
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
  generateHintsForContext(context, instructiveTriple, domNode, options = {}){
    const domainUri = this.findTypeForInstructive(context, instructiveTriple);
    const hints = [];
    const text = context.text;
    const location = context.region;
    hints.push({text, location, domainUri, domNode, instructiveUri: instructiveTriple.predicate, options});
    return hints;
  },

  ascendDomNodesUntil(rootNode, domNode, condition){
    if(!domNode || rootNode.isEqualNode(domNode)) return null;
    if(!condition(domNode))
      return this.ascendDomNodesUntil(rootNode, domNode.parentElement, condition);
    return domNode;
  },

  domNodeMatchesRdfaInstructive(instructiveRdfa){
    let ext = 'http://mu.semte.ch/vocabularies/ext/';
    return (domNode) => {
      if(!domNode.attributes || !domNode.attributes.property)
        return false;
      let expandedProperty = domNode.attributes.property.value.replace('ext:', ext);
      if(instructiveRdfa.predicate == expandedProperty)
        return true;
      return false;
    };
  },

  conditionDomNodeIsTypeof(uri){
    return (domNode) => get( domNode, "attributes.typeof.value" ) == uri;
  },

  findDomNodeForContext(editor, context, condition){
    let richNodes = isArray(context.richNode) ? context.richNode : [ context.richNode ];
    let domNode = richNodes
        .map(r => this.ascendDomNodesUntil(editor.rootNode, r.domNode, condition))
        .find(d => d);
    if(!domNode){
      warn(`Trying to work on unattached domNode. Sorry can't handle these...`, {id: 'scoped-bestuursorgaan.domNode'});
    }
    return domNode;
  }

});

export default RdfaEditorScopedBestuursorgaanPlugin;
