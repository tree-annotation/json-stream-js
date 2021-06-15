import {SymToJsonEvent} from './SymToJsonEvent.js'


export const JsonEventToDao = () => {
  let ret = ''
  let mode = 'top'

  // note: what is lost in translation: top-level padding
  //   commas, colons

  let hexBuf = ''
  return {
    push: (event) => {
      // console.log(event)
      const {id} = event

      // todo: what about an array like [{}] or [[]]?
      // vs isEmpty
      // need a stack for arrays

      if (mode === 'top') {
        if (id === 'open string') {
          ret += '['
          mode = 'string'
        } else if (id === 'open key') {
          mode = 'string'
        } else if (id === 'open number') {
          ret += '['
          mode = 'number'
        } else if (['open object', 'open array'].includes(id)) {
          ret += '['
        } else if (['close object', 'close array'].includes(id)) {
          ret += ']'
        } else if (id === 'close true') {
          ret += '[true]'
        } else if (id === 'close false') {
          ret += '[false]'
        } else if (id === 'close null') {
          ret += '[null]'
        } else if (['comma', 'colon'].includes(id)) {
          // todo?
        } else if (id === 'whitespace') {
          // ret += event.sym
        } else throw Error(`unrecognized event ${id}`)
      } else if (mode === 'string') {
        if (id === 'buffer') {
          const {sym} = event
          if ('[]`'.includes(sym)) ret += '`' + sym
          else ret += sym
        } else if (id === 'escape') {
          mode = 'escape'
        } else if (id === 'open hex') {
          hexBuf = ''
          mode = 'hex'
        } else if (id === 'close string') {
          ret += ']'
          mode = 'top'
        } else if (id === 'close key') {
          mode = 'top'
        }
      } else if (mode === 'escape') {
        if (id === 'buffer') {
          const {sym} = event
          if (sym === 'n') ret += '\n'
          else if (sym === 't') ret += '\t'
          else if (sym === 'r') ret += '\r'
          else if (sym === 'b') ret += '\b'
          else if (sym === 'f') ret += '\f'
          else if (sym === '"') ret += '"'
          else if (sym === '\\') ret += '\\'
          else if (sym === '/') ret += '/'
          mode = 'string'
        }
      } else if (mode === 'hex') {
        if (id === 'buffer') {
          hexBuf += event.sym
        } else if (id === 'close hex') {
          ret += Number.parseInt(hexBuf, 16)
          mode = 'string'
        }
      } else if (mode === 'number') {
        if (id === 'buffer') {
          ret += event.sym
        } else if (id === 'close number') {
          ret += ']'
          mode = 'top'
        }
      } else {
        throw Error('unknown mode')
      }
    },
    end: (event) => {
      const r = ret
      ret = ''
      // console.assert(event.id === 'end')
      // ret += ws(event.wsBuffer)
      // console.log('dtao', ret)
      return r
    },
  }
}

const bsample = `{
     "firstName": "John",
     "lastName" : "Smith",
     "age"      : 25,
     "address"  :
     {
         "streetAddress": "21 2nd Street",
         "city"         : "New York",
         "state"        : "NY",
         "postalCode"   : "10021"
     },
     "phoneNumber":
     [
         {
           "type"  : "home",
           "number": "212 555-1234"
         },
         {
           "type"  : "fax",
           "number": "646 555-4567"
         }
     ]
 }`

const next = {push: () => {}, end: () => {}}
// const stream = SymToJsonEvent(next)
const stream = SymToJsonEvent(JsonEventToDao())

let lastRet
console.time('bench')
for (let i = 0; i < 100000; ++i) {
  for (let i = 0; i < bsample.length; ++i) {
    stream.push(bsample[i])
  }
  lastRet = stream.end()
  stream.reset()
}
console.timeEnd('bench')
console.log(lastRet)
// vs clarinet
// https://github.com/dscape/clarinet/blob/master/bench/results/sync/dscape-wikipedia.csv