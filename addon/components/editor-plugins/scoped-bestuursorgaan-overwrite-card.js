import Component from '@ember/component';
import EmberObject from '@ember/object';
import layout from '../../templates/components/editor-plugins/scoped-bestuursorgaan-overwrite-card';
import InsertResourceRelationCardMixin from '@lblod/ember-generic-model-plugin-utils/mixins/insert-resource-relation-card-mixin';
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
      'include':'is-tijdsspecialisatie-van,is-tijdsspecialisatie-van.bestuurseenheid'
    };
    let bestuursorganenInTijd = yield this.store.query('bestuursorgaan', query);
    this.set('bestuursorganenInTijd', bestuursorganenInTijd);

  }).restartable(),

  async buildRdfa(data, nodeToReplace){
    //Add extra RDFA annotations to be used by other plugins
    let extRdfa = `<span property="ext:zittingBestuursorgaanInTijd" resource=${data.uri}>
                     ${await data.get('isTijdsspecialisatieVan.naam')}
                   </span>`;
    let property = nodeToReplace.attributes.property ? `property=${nodeToReplace.attributes.property.value}` : '';
    let rdfa = `<div ${property} typeof=${nodeToReplace.attributes.typeof.value} resource=${await data.get('isTijdsspecialisatieVan.uri')}>
                  ${extRdfa}
               </div>`;

    return rdfa;
  },

  //if text doesn't change, nothing will be triggered. So we need to keep hint
  async needsNewHint(data, nodeToReplace){
    return (await data.get('isTijdsspecialisatieVan.uri')) == nodeToReplace.attributes.resource.value;
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

  actions: {
    async refer(data){
      let newNodes = this.editor.replaceNodeWithHTML(this.info.domNodeToUpdate, await this.buildRdfa(data, this.info.domNodeToUpdate), true);
      this.get('hintsRegistry').removeHintsAtLocation(this.location, this.get('hrId'), this.card);
      if(await this.needsNewHint(data, this.info.domNodeToUpdate)){
        this.hintsRegistry.addHints(this.hrId, this.card, [ this.generateCard(newNodes[0]) ]);
      }
    }
  }
});
