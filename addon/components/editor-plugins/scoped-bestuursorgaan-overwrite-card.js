import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/scoped-bestuursorgaan-overwrite-card';
import InsertResourceRelationCardMixin from '@lblod/ember-generic-model-plugin-utils/mixins/insert-resource-relation-card-mixin';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

export default Component.extend(InsertResourceRelationCardMixin, {
  layout,
  currentSession: service(),
  store: service(),

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

   didReceiveAttrs() {
    this._super(...arguments);
    this.get('getBestuursorganen').perform();
   },

  actions: {
    async refer(data){
      this.editor.replaceNodeWithHTML(this.info.domNodeToUpdate, await this.buildRdfa(data, this.info.domNodeToUpdate), true);
      this.get('hintsRegistry').removeHintsAtLocation(this.location, this.get('hrId'), 'editor-plugins/scoped-bestuursorgaan-overwrite-card');
    }
  }
});
