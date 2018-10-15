import Service from '@ember/service';
import EmberObject from '@ember/object';
import { task } from 'ember-concurrency';
import { isArray } from '@ember/array';
import { warn } from '@ember/debug';

/**
 * Service responsible for correct annotation of dates
 *
 * @module editor-scoped-bestuursorgaan-plugin
 * @class RdfaEditorScopedBestuursorgaanPlugin
 * @constructor
 * @extends EmberService
 */
const RdfaEditorScopedBestuursorgaanPlugin = Service.extend({

  /**
   * Restartable task to handle the incoming events from the editor dispatcher
   *
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

    const hints = [];
    contexts.forEach((context) => {
      let relevantContext = this.detectRelevantContext(context);
      if (relevantContext) {
        let richNodes = isArray(context.richNode) ? context.richNode : [ context.richNode ];
        let domNode = richNodes
              .map(r => this.getDomElementForRdfaInstructiveContext(editor.rootNode, r.domNode, relevantContext.predicate))
              .find(d => d);
        if(!domNode){
          warn(`Trying to work on unattached domNode. Sorry can't handle these...`, {id: 'scoped-bestuursorgaan.domNode'});
          return;
        }
        hintsRegistry.removeHintsInRegion(context.region, hrId, this.get('who'));
        hints.pushObjects(this.generateHintsForContext(context, relevantContext, domNode));
      }
    });
    const cards = hints.map( (hint) => this.generateCard(hrId, hintsRegistry, editor, hint));
    if(cards.length > 0){
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  }).restartable(),

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
    if(context.context.slice(-1)[0].predicate == "http://mu.semte.ch/vocabularies/ext/scopedBestuursorgaanText"){
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
  generateCard(hrId, hintsRegistry, editor, hint){
    return EmberObject.create({
      info: {
        label: 'Voeg het relevante bestuursorgaan toe.',
        plainValue: hint.text,
        location: hint.location,
        domainUri: hint.domainUri,
        domNodeToUpdate: hint.domNode,
        instructiveUri: hint.instructiveUri,
        hrId, hintsRegistry, editor
      },
      location: hint.location,
      card: this.get('who')
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
  generateHintsForContext(context, instructiveTriple, domNode){
    const domainUri = this.findTypeForInstructive(context, instructiveTriple);
    const hints = [];
    const text = context.text;
    const location = context.region;
    hints.push({text, location, domainUri, domNode, instructiveUri: instructiveTriple.predicate});
    return hints;
  },

  /**
   * Find matching domNode for RDFA instructive.
   * We don't exactly know where it is located, hence some walking back.
   */
  getDomElementForRdfaInstructiveContext(rootNode, domNode, instructiveRdfa){
    let ext = 'http://mu.semte.ch/vocabularies/ext/';
    if(!domNode || rootNode.isEqualNode(domNode)) return null;
    if(!domNode.attributes || !domNode.attributes.property){
      return this.getDomElementForRdfaInstructiveContext(rootNode, domNode.parentElement, instructiveRdfa);
    }

    let expandedProperty = domNode.attributes.property.value.replace('ext:', ext);
    if(instructiveRdfa == expandedProperty)
      return domNode;
    return this.getDomElementForRdfaInstructiveContext(rootNode, domNode.parentElement, instructiveRdfa);
  }

});

RdfaEditorScopedBestuursorgaanPlugin.reopen({
  who: 'editor-plugins/scoped-bestuursorgaan-card'
});
export default RdfaEditorScopedBestuursorgaanPlugin;
