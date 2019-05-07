import { warn } from '@ember/debug';
import Component from '@ember/component';
import EmberObject from '@ember/object';
import layout from '../../templates/components/editor-plugins/scoped-bestuursorgaan-overwrite-card';
import InsertResourceRelationCardMixin from '@lblod/ember-rdfa-editor-generic-model-plugin-utils/mixins/insert-resource-relation-card-mixin';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

export default Component.extend(InsertResourceRelationCardMixin, {
  layout,
  currentSession: service(),
  store: service(),

  card: 'editor-plugins/scoped-bestuursorgaan-overwrite-card',

  getBestuursorganen: task(function * (){
    let currentBestuurseenheid = yield this.currentSession.get('group');
    let query = {
      'filter[is-tijdsspecialisatie-van][bestuurseenheid][id]': currentBestuurseenheid.id,
      'include':'is-tijdsspecialisatie-van,is-tijdsspecialisatie-van.bestuurseenheid',
      'sort': '-binding-start'
    };
    let bestuursorganenInTijd = yield this.store.query('bestuursorgaan', query);
    this.set('bestuursorganenInTijd', bestuursorganenInTijd);

  }).restartable(),

  async buildRdfa( data, nodeToReplace ){
    let property = nodeToReplace.getAttribute('property') ? `property="${nodeToReplace.getAttribute('property')}"` : '';
    let rdfa = `<span ${property} typeof="${nodeToReplace.getAttribute('typeof')}" resource="${await data.uri}">
                  ${await data.get('isTijdsspecialisatieVan.naam')}
               </span`;

    return rdfa;
  },

  //if text doesn't change, nothing will be triggered. So we need to keep hint.
  // This case should actually be taken care of by rdfa-editor.
  async needsNewHint(data, nodeToReplace){
    return nodeToReplace.textContent.indexOf(data.get('isTijdsspecialisatieVan.naam')) > -1;
  },

   didReceiveAttrs() {
    this._super(...arguments);
    this.get('getBestuursorganen').perform();
   },

  generateCard(domNode){
    return EmberObject.create({
      info: {
        label: 'Voeg het relevante bestuursorgaan toe.',
        plainValue: this.info.text,
        location: this.location,
        domainUri: this.info.domainUri,
        domNodeToUpdate: domNode,
        instructiveUri: this.info.instructiveUri,
        hrId: this.hrId, hintsRegistry: this.hintsRegistry, editor: this.editor
      },
      location: this.location,
      options: { noHighlight: true },
      card: this.card
    });
  },

  findNodeToReplace() {
    let newLocation = this.hintsRegistry.updateLocationToCurrentIndex( this.hrId, this.location );
    let nodeToReplace = this.editor
        .getContexts( { region: newLocation } )
        .find( (block) => block.context.find(
          (context) => context.predicate == 'a' && context.object == 'http://data.vlaanderen.be/ns/besluit#Bestuursorgaan' ) )
        .richNode[0]
        .domNode;

    // TODO: cope with region yielding too many context blocks and the
    // first one not being the right one.  Note that the current
    // context scanner can't yield this case, yet it's not guaranteed
    // not to yield it.

    // TODO: this sort of logic should be in contenteditable (or
    // better yet, in the generic offered API)

    if( !nodeToReplace ) {
      warn("Could not find node to replace from contexts", {id: 'bestuursorgaanplugin.nodetoreplace'});
    }

    while( !nodeToReplace.getAttribute
           || ( nodeToReplace.getAttribute( "typeof" ) !== 'http://data.vlaanderen.be/ns/besluit#Bestuursorgaan'
               && nodeToReplace.getAttribute( "typeof" ) != 'besluit:Bestuursorgaan' ) ) {
      // TODO: this is terrible, we should cope with the prefixes!
      nodeToReplace = nodeToReplace.parentNode;

      if( !nodeToReplace ) {
        warn("Could not find suitable node to replace in tree",  {id: 'bestuursorgaanplugin.nodetoreplace'});
      }
    }

    return nodeToReplace;
  },

  actions: {
    async refer(data){
      let nodeToReplace = this.findNodeToReplace();
      let newNodes = this.editor.replaceNodeWithHTML(nodeToReplace, await this.buildRdfa(data, nodeToReplace), true);
      this.get('hintsRegistry').removeHintsAtLocation(this.location, this.get('hrId'), this.card);
      if(await this.needsNewHint(data, nodeToReplace)){
        this.hintsRegistry.addHints(this.hrId, this.card, [ this.generateCard(newNodes[0]) ]);
      }
    }
  }
});
