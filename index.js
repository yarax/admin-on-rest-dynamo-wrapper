// @flow
/*:: type Request = {query: Object, get: Function} */;
/*:: type Response = {set: Function, json: Function} */;
/*:: type DynamoList = {length: number, lastKey: {}, scannedCount: number}*/

function listWrapper(req/*: Request*/, res/*: Response*/) {
  return (Model/*: any*/)/*: Promise<{}>*/ => {
    //code.options.description
    const searchFields = {};
    if (Model['$__'] && typeof(Model['$__'].table.schema.attributes) === 'object') {
      const attrs = Model['$__'].table.schema.attributes;
      Object.keys(attrs).forEach((attr) => {
        if (attrs[attr].options && typeof (attrs[attr].options.description) === 'string') {
          try {
            const conf = JSON.parse(attrs[attr].options.description);
            searchFields[attr] = conf.searchField;
          } catch(e) {
            console.log('Cannot parse field description', attrs[attr].options.description, ' of attr ', attr);
          }
        }
      });
    }
    const cursor = Model.scan();
    const lastKey = req.get('x-lastkey');
    const limit = req.query.per_page;
    const filter = req.query.filter;

    if (filter) {
      if (!Object.keys(searchFields).length) {
        console.log('Cannot apply filter without searchField');
      } else {
        const filterObj = JSON.parse(filter);
        console.log('searchField', searchFields, ' contains ', filter);
        Object.keys(filterObj).forEach(fieldName => {
          if (!searchFields[fieldName]) {
            throw new Error('Provided unknown search field' + fieldName);
          }
          console.log('where', fieldName, ' ', searchFields[fieldName], filterObj[fieldName]);
          cursor.where(fieldName)[searchFields[fieldName]](filterObj[fieldName]);
        });
        
      }
    }
    if (lastKey && lastKey !== 'undefined') {
      try {
        const parsedLastKey = JSON.parse(lastKey);
        cursor.startAt(parsedLastKey);
      } catch (e) {
        console.log('Could not parse lastKey', lastKey, e);
      }
    }
    if (limit && !filter) {
      cursor.limit(limit);
    }
    return cursor;
  }
}

function updateObjectWrapper(req/*: Object*/, obj/*: {updatedBy? : string, updatedAt?: number}*/) {
  const user = req.apiGateway && req.apiGateway.event && req.apiGateway.event.requestContext && req.apiGateway.event.requestContext.identity && req.apiGateway.event.requestContext.identity.cognitoAuthenticationProvider;
  console.log(req, JSON.stringify(req.apiGateway));
  if (user) {
    obj.updatedBy = user;
  }
  obj.updatedAt = Date.now()
  return obj;
}

function responseWrapper(res/*: Response*/) {
  return (items/*: DynamoList*/) => {
    res.set('x-lastkey', JSON.stringify(items.lastKey));
    res.set('x-total-count', 1000000);
    res.set('Access-Control-Expose-Headers', 'x-total-count, x-lastkey');
    res.set('Access-Control-Allow-Methods', '*');
    res.set('Access-Control-Allow-Headers', '*');
    res.json(items);
    return items;
  }
}

module.exports = {
  listWrapper,
  responseWrapper,
  updateObjectWrapper
}


/**
 * 
 *       if (req.query.sort) {
        try {
          const sort = JSON.parse(req.query.sort);
          if (sort[1] === 'DESC') {
            cursor.descending();
          }
        } catch (e) {
          console.log('Cannot parse sort parameter', req.query.sort);
        }
      }
 */