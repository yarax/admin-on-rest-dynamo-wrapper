// @flow
/*:: type Request = {query: Object, get: Function} */;
/*:: type Response = {set: Function, json: Function} */;
/*:: type DynamoList = {length: number, lastKey: {}, scannedCount: number}*/

function listWrapper(req/*: Request*/, res/*: Response*/) {
  return (Model/*: any*/)/*: Promise<{}>*/ => {
    const cursor = Model.scan();
    const lastKey = req.get('x-lastkey');
    const limit = req.query.per_page;
    if (limit) {
      cursor.limit(limit);
    }
    if (lastKey) {
      try {
        const parsedLastKey = JSON.parse(lastKey);
        cursor.startAt(parsedLastKey);
      } catch (e) {
        console.log('Could not parse lastKey', lastKey, e);
      }
    }
    return cursor;
  }
}

function responseWrapper(res/*: Response*/) {
  return (items/*: DynamoList*/) => {
    res.set('x-lastkey', JSON.stringify(items.lastKey));
    res.set('x-total-count', items.scannedCount);
    res.json(items);
    return items;
  }
}

module.exports = {
  listWrapper,
  responseWrapper
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