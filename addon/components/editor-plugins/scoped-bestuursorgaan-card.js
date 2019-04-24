import Component from '@ember/component';
import serializeToJsonApi from '../../utils/serialize-to-json-api';
import layout from '../../templates/components/editor-plugins/scoped-bestuursorgaan-card';
import InsertResourceRelationCardMixin from '@lblod/ember-rdfa-editor-generic-model-plugin-utils/mixins/insert-resource-relation-card-mixin';
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

  getBestuursorganen: task(function * (){
    let currentBestuurseenheid = yield this.currentSession.get('group');
    let properties = yield this.metaModelQuery.findPropertiesWithRange(this.get('info.domainUri'), 'http://data.vlaanderen.be/ns/besluit#BestuursOrgaan');

    //if multiple properties are found we want to display this in template
    if(properties.length > 1)
      this.set('displayProperties', true);

    let query = {
      'filter[is-tijdsspecialisatie-van][bestuurseenheid][id]': currentBestuurseenheid.id,
      'include':'is-tijdsspecialisatie-van,is-tijdsspecialisatie-van.bestuurseenheid',
      'sort': '-binding-start'
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
    let bestuursorgaanJsonApi = serializeToJsonApi(await data.b);
    let rdfa = await this.getReferRdfa(data.p, bestuursorgaanJsonApi, await data.b.get('isTijdsspecialisatieVan.naam'));
    return rdfa;
  },

  didReceiveAttrs() {
    this._super(...arguments);
    this.get('getBestuursorganen').perform();
  },

  actions: {
    async refer(data){
      const rdfa = await this.buildRdfa(data);
      // TODO: we should figure out the updated position of our
      // annotation.  then we should find the lowest node containing
      // this slab of content and we should walk up from there to find
      // the right dom node for us to replace the contents of.  in all
      // other cases this code will be broken if the text node which
      // we're given is replaced.
      this.get('hintsRegistry').removeHintsAtLocation(this.location, this.get('hrId'), 'editor-plugins/scoped-bestuursorgaan-card');
      this.editor.replaceNodeWithHTML(this.info.domNodeToUpdate , rdfa, true);
    }
  }
});
