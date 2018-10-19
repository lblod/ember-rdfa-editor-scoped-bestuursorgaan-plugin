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
    let cardName;

    yield Promise.all(contexts.map(async (context) => {
      let triple = this.detectRelevantContext(context);
      if (!triple)
        return;

      if(triple.predicate === this.insertStandAloneBestuurseenheid){
        let domNode = this.findDomNodeForContext(editor, context, this.domNodeMatchesRdfaInstructive(triple));
        if(!domNode) return;
        let bestuurseenheid = await this.currentSession.get('group');
        editor.
          replaceNodeWithHTML(domNode,
                              `<span typeOf=besluit:Bestuurseenheid resource=${bestuurseenheid.uri}>
                                 ${bestuurseenheid.naam}
                               </span>`);
      }

      if(triple.predicate === this.insertScopedOrgaan){
        let domNode = this.findDomNodeForContext(editor, context, this.domNodeMatchesRdfaInstructive(triple));
        if(!domNode) return;
        cardName = this.scopedOrgaan;
        hintsRegistry.removeHintsInRegion(context.region, hrId, cardName);
        hints.pushObjects(this.generateHintsForContext(context, triple, domNode));
      }

      if(triple.object === this.overwriteScopedOrgaan){
        //the overwriteScopedOrgaan context is always wrapped by insertScopedOrgaan context.
        let nodeToReplace = this.findDomNodeForContext(editor, context, this.domNodeIsTypeof(this.overwriteScopedOrgaan));
        cardName = this.overwriteCard;
        hintsRegistry.removeHintsInRegion(context.region, hrId, cardName);
        hints.pushObjects(this.generateHintsForContext(context, triple, nodeToReplace, { noHighlight: true }));
      }
    }));

    const cards = hints.map( (hint) => this.generateCard(hrId, hintsRegistry, editor, hint, cardName));
    if(cards.length > 0){
      hintsRegistry.addHints(hrId, cardName, cards);
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
  generateCard(hrId, hintsRegistry, editor, hint, cardName){
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

  domNodeIsTypeof(uri){
    return (domNode) => {
      if(!domNode.attributes || !domNode.attributes.typeof){
        return false;
      }
      if(domNode.attributes.typeof.value == uri){
        return true;
      }
      return false;
    };
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
