import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/scoped-bestuursorgaan-card';
import InsertResourceRelationCardMixin from '@lblod/ember-generic-model-plugin-utils/mixins/insert-resource-relation-card-mixin';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

/**
* Card displaying a hint of the Scoped bestuursorgaan
*
* @module editor-scoped-bestuursorgaan-plugin
* @class ScopedBestuursorgaanCard
* @extends Ember.Component
*/
export default Component.extend(InsertResourceRelationCardMixin, {
  metaModelQuery: service(),
  currentSession: service(),
  store: service(),

  layout,

  serializeToJsonApi(resource){
    let serializedResource = resource.serialize({includeId: true});
    //This is because we're not sure uri is kept (due to bug in mu-cl-resources/or ember-ds?)
    serializedResource.data.attributes.uri = resource.uri;
    return serializedResource;
  },

  getBestuursorganen: task(function * (){
    let currentBestuurseenheid = yield this.currentSession.get('group');
    let properties = yield this.metaModelQuery.findPropertiesWithRange(this.get('info.domainUri'), 'http://data.vlaanderen.be/ns/besluit#BestuursOrgaan');

    //if multiple properties are found we want to display this in template
    if(properties.length > 1)
      this.set('displayProperties', true);

    let query = {
      'filter[is-tijdsspecialisatie-van][bestuurseenheid][id]': currentBestuurseenheid.id,
      'include':'is-tijdsspecialisatie-van,is-tijdsspecialisatie-van.bestuurseenheid'
    };
    let bestuursorganenInTijd = yield this.store.query('bestuursorgaan', query);
    let bestuursorganenProperties = [];
    bestuursorganenInTijd.forEach(b => {
      properties.forEach(p => {
        bestuursorganenProperties.push({'b': b, 'p': p});
      });
    });
    this.set('bestuursorganenProperties', bestuursorganenProperties);

  }).restartable(),


  async buildRdfa(data){
    //Add extra RDFA annotations to be used by other plugins
    let extRdfa = `<span property="ext:zittingBestuursorgaanInTijd" resource=${data.b.uri}>
                 ${await data.b.get('isTijdsspecialisatieVan.naam')}
               </span>`;

    //The part which matches the provided model
    let bestuursorgaanJsonApi = this.serializeToJsonApi(await data.b.get('isTijdsspecialisatieVan'));
    let rdfa = await this.getReferRdfa(data.p, bestuursorgaanJsonApi, extRdfa);
    return rdfa;
  },

  didReceiveAttrs() {
    this._super(...arguments);
    this.get('getBestuursorganen').perform();
  },

  actions: {
    async refer(data){
      this.editor.replaceNodeWithHTML(this.info.domNodeToUpdate , await this.buildRdfa(data), true);
      this.get('hintsRegistry').removeHintsAtLocation(this.location, this.get('hrId'), 'editor-plugins/scoped-bestuursorgaan-card');
    }
  }
});
