// todo: make a good impl based on inner functions; after it's tested and benchmarked, inline all the functions and see if it improves things

const charCode0 = '0'.charCodeAt(0)
const charCode1 = '1'.charCodeAt(0)
const charCode9 = '9'.charCodeAt(0)
const charCodeLowerA = 'a'.charCodeAt(0)
const charCodeLowerF = 'f'.charCodeAt(0)
const charCodeUpperA = 'A'.charCodeAt(0)
const charCodeUpperF = 'F'.charCodeAt(0)

const isZeroNine = (sym) => {
  const code = sym.charCodeAt(0)
  return code >= charCode0 && code <= charCode9
}

const isOneNine = (sym) => {
  const code = sym.charCodeAt(0)
  return code >= charCode1 && code <= charCode9
}

const isWhitespace = (sym) => {
  return sym === ' ' || sym === '\n' || sym === '\t' || sym === '\r'
}

// todo?: perhaps Continue should be Ok
// todo?: maybe if eat before emit returns error, the parser should stop with error too
const Continue = {id: 'continue'}
const Mismatch = {id: 'mismatch'}

// todo?: make trailing commas invalid by treating first value different from next/last value

// might be useful to have open string and close string events
//    
// where you can decide to ignore the string -- same for key?
// this could make sense to ignore values of certain keys
//  could even set event granularity, e.g. events for substrings, where you could search strings for some needle

// todo: JsonEventType.true, ...

// todo?: replace f*alse, f[a]lse w/ f|alse, etc.

// todo: nice error msgs

// todo: check if next.push(type) is more optimal than next.push({type})
//    and if next.push('buffer', sym) is more optimal than next.push({type: 'buffer', sym})
//    another opton: next.push('buffer', {sym})

// todo: built-in line, col, pos information; in particular in returned {id: error} feedback msgs

// todo: more test suites

// SymToJson.make

// possible opt: dont emit eat on true, false, null (marginal)
// todo: should we continue to throw if (isDone) or ret error?

// todo: add if parent/top to closeParent
// todo: call closeParent in value, merge 'initial' & '*value'

export const SymToJsonEvent = (next) => {
  let isDone = false
  let choiceId = 'initial'
  let parents = ['top']
  let hexSeqIdx = 0

  // todo: perhaps remove reset
  // ? todo: error recovery mechanism that doesn't reset state completely?
  const reset = () => {
    isDone = false
    // todo: rename to stateId? stateLabel?
    choiceId = 'initial'
    parents = ['top']
    hexSeqIdx = 0
  }

  // todo?: remove, error on end shows only choiceId
  const dumpState = () => JSON.stringify({
    isDone, 
    choiceId, 
    parents,
  })

  const eat = (sym) => { return next.push({id: 'buffer', sym}) }
  // todo: eatEmitFork
  const eatFork = (sym, nextChoiceId) => {
    choiceId = nextChoiceId
    return next.push({id: 'buffer', sym})
  }
  const eatPrefix = (sym) => { return next.push({id: 'whitespace', sym}) }
  // todo: add sym arg, eatEmit
  const emit = (id, nextChoiceId) => {
    // todo: id -> type
    choiceId = nextChoiceId
    return next.push({
      id,
    })
  }

  // -todo: add sym arg, eatEmitValue
  // todo? in most cases eat, emitvalue could be replaced with eatemitvalue
  const emitValue = (id) => {
    const parent = parents[parents.length - 1]
    return emit(id, parent === 'top'? 'initial': 'value*')
  }

  // returning continue, next.push result, setting status ready for .end()
  // extracting repeated fragments

  const error = (message) => {
    // todo? special error status
    isDone = true
    return {id: 'error', message}
  }

  const value = (sym) => {
    switch (sym) {
      case '{': {
        parents.push('object')
        parents.push('key')
        // todo: eatEmitFork(sym, 'open object', '*key')
        return emit('open object', '*key')
      }
      case '[': {
        parents.push('array')
        // todo: eatEmitFork(sym, 'open array', '*value')
        return emit('open array', '*value')
      }
      // todo: eatEmitFork(sym, 'open string', '"*')
      case '"': return emit('open string', '"*')
      // todo: eatEmitFork(sym, 'open true', 't*rue')
      case 't': return emit('open true', 't*rue')
      // todo: eatEmitFork(sym, 'open false', 'f*alse')
      case 'f': return emit('open false', 'f*alse')
      // todo: eatEmitFork(sym, 'open null', 'n*ull')
      case 'n': return emit('open null', 'n*ull')
      // todo: eatEmitFork(sym, 'open number', '-*')
      case '-': {
        emit('open number', '-*')
        return eat(sym)
      }
      // todo: eatEmitFork(sym, 'open number', '0*')
      case '0': {
        emit('open number', '0*')
        return eat(sym)
      }
      default: {
        // todo: eatEmitFork(sym, 'open number', '1-9*')
        // todo: '1-9*' -> '[1-9]*'
        if (isOneNine(sym)) {
          emit('open number', '1-9*')
          return eat(sym)
        }
        if (isWhitespace(sym)) return eatPrefix(sym)

        // return closeParent(sym)

        // return {id: 'error', message: `Unexpected symbol in value ${sym}`}
        return Mismatch
      }
    }
  }
  const fraction = (sym) => {
    // todo: eatEmitFork(sym, 'mid number', '0-9.*')
    if (sym === '.') return eatFork(sym, '0-9.*')
    return exponent(sym)
  }
  const exponent = (sym) => {
    // todo: eatEmitFork(sym, 'mid number', 'exp*')
    if ('eE'.includes(sym)) return eatFork(sym, 'exp*')
    return number(sym)
  }
  const number = (sym) => {
    // we assume here that sym is a non-numeric symbol that terminates the number
    // note: eatemitvalue is not suitable here
    // todo: or actually do eatemitvalue here -- just don't treat it as part of number it in the consumer
    // OR: let this emit be for the previous symbol!
    emitValue('close number')
    // the terminating symbol is part of what comes after the number -- essentially a space or a comma or a parent close
    // let the standard flow handle that

    // return value*|initial(sym)
    return self.push(sym)
  }

  const closeParent = (sym) => {
    const parent = parents[parents.length - 1]

    if (parent === 'object' && sym === '}') {
      parents.pop()
      // could eatEmitValue just as well
      // eatEmitValue(sym, 'close object')
      return emitValue('close object')
    } 
    if (parent === 'array' && sym === ']') {
      parents.pop()
      // could eatEmitValue just as well
      // eatEmitValue(sym, 'close array')
      return emitValue('close array')
    }
    // if parent === 'top' error('unexpected top')
    return error(`Expected whitespace or comma or ${parent} close, got ${sym}`)
  }

  const self = {
    // todo: should reset stay?
    reset,
    isDone: () => isDone,
    push: (sym) => {
      if (isDone) {
        // todo: fix error msg
        throw Error(`PUSH: Matcher already completed! ${dumpState()}`)
      }

      // todo: prioritize? order by most often hit branches first
      switch (choiceId) {
        case 'initial': {
          const ret = value(sym)
          if (ret === Mismatch) {
            return error(`Unexpected top-level symbol ${sym}`)
          }
          return ret
        }
        case '*value': {
          const ret = value(sym)
          if (ret === Mismatch) return closeParent(sym)
          return ret
        } 
        case 'value*': {
          if (sym === ',') {
            const parent = parents[parents.length - 1]

            if (parent === 'object') {
              parents.push('key')
              // todo: eatEmitFork(sym, 'comma', '*key')
              return emit('comma', '*key')
            } 
            // todo: eatEmitFork(sym, 'comma', '*value')
            if (parent === 'array') return emit('comma', '*value')
            return error(`Unexpected parent ${parent}`)
          }
          if (isWhitespace(sym)) return eatPrefix(sym)
          return closeParent(sym)
        } 
        case '*key': {
          // todo: eatEmitFork(sym, 'open key', '"*')
          // todo: emit('open string')
          if (sym === '"') return emit('open key', '"*')
          if (sym === '}') {
            parents.pop()
            parents.pop()
            // eatemitvalue would work here too
            // eatEmitValue(sym, 'close object')
            return emitValue('close object')
          } 
          if (isWhitespace(sym)) return eatPrefix(sym)
          
          return error(`Expected whitespace or " or object close, got ${sym}`)
        } 
        case 'key*': {
          // todo: emit key either on +close string or :
          if (sym === ':') {
            parents.pop()
            // alt: 'close key'
            // todo: eatEmitFork(sym, 'colon', '*value')
            return emit('colon', '*value')
          } 
          if (isWhitespace(sym)) return eatPrefix(sym)
          
          return error(`Expected : or whitespace, got ${sym}`)
        }
        case '"*': {
          if (sym === '"') {
            const parent = parents[parents.length - 1]
            // note: eatemitvalue
            // todo: eatEmitFork(sym, 'key', 'key*')
            // eat(sym)
            if (parent === 'key') return emit('close key', 'key*')
            // hmm
            // todo: eatEmitValue(sym, 'close string')
            return emitValue('close string')
          } 
          // todo: eatEmitFork(sym, 'escape', '\\*')
          if (sym === '\\') return emit('escape', '\\*')
          
          const code = sym.charCodeAt(0)
          // todo: eatEmit(sym, 'mid string')
          if (code >= 0x0020 && code <= 0x10ffff) return eat(sym)
          
          return error(`Unexpected control character: ${code}`)
        } 
        case '\\*': {
          if ('"\\/bfnrt'.includes(sym)) return eatFork(sym, '"*')
          if (sym === 'u') return emit('open hex', '\\u*')
          
          return error(`Invalid escape character: ${sym}`)
        } 
        case '\\u*': {
          // '0123456789abcdefABCDEF'.includes(sym)
          const code = sym.charCodeAt(0)
          if (
            (code >= charCode0 && code <= charCode9) ||
            (code >= charCodeLowerA && code <= charCodeLowerF) ||
            (code >= charCodeUpperA && code <= charCodeUpperF)
          ) {
            if (hexSeqIdx < 3) {
              hexSeqIdx += 1
              return eat(sym)
            }

            hexSeqIdx = 0
            return emit('close hex', '"*')
          } 

          return error(`Invalid hexadecimal escape character: ${sym}`)
        } 
        case '-*': {
          if (sym === '0') return eatFork(sym, '0*')
          
          if (isOneNine(sym)) return eatFork(sym, '1-9*')

          return error(`Expected -[0-9], got -[${sym}]`)
        } 
        case '0*': return fraction(sym)
        case '1-9*': {
          if (isZeroNine(sym)) return eatFork(sym, '1-90-9*')
          else return fraction(sym)
        } 
        case '0-9.*': {
          if (isZeroNine(sym)) return eatFork(sym, '0-9.0-9*')
          
          return error(`Expected 0-9, got ${sym}`)
        } 
        case 'exp*': {
          if ('+-'.includes(sym)) return eatFork(sym, 'exp+-*')
          
          if (isZeroNine(sym)) return eatFork(sym, 'exp+-0-9')

          return error(`Expected +-0..9, got ${sym}`)
        }
        case 'exp+-*': {
          if (isZeroNine(sym)) return eatFork(sym, 'exp+-0-9')

          return error(`Expected digit, got ${sym}`)
        } 
        case '1-90-9*': {
          if (isZeroNine(sym)) return eat(sym)
          return fraction(sym)
        } 
        case '0-9.0-9*': {
          if (isZeroNine(sym)) return eat(sym)
          return exponent(sym)
        }
        case 'exp+-0-9': {
          if (isZeroNine(sym)) return eat(sym)
          return number(sym)
        } 
        case 't*rue': {
          if (sym === 'r') return eatFork(sym, 'tr*ue')
          return error(`Expected t[r]ue, got t[${sym}]...`)
        } 
        case 'tr*ue': {
          // todo: don't eat literals
          if (sym === 'u') return eatFork(sym, 'tru*e')
          return error(`Expected tr[u]e, got tr[${sym}]...`)
        } 
        case 'tru*e': {
          if (sym === 'e') {
            eat(sym)
            return emitValue('close true')
          }
          return error(`Expected tru[e], got tru[${sym}]...`)
        } 
        case 'f*alse': {
          if (sym === 'a') return eatFork(sym, 'fa*lse')
          return error(`Expected f[a]lse, got f[${sym}]...`)
        } 
        case 'fa*lse': {
          if (sym === 'l') return eatFork(sym, 'fal*se')
          return error(`Expected fa[l]se, got fa[${sym}]...`)
        } 
        case 'fal*se': {
          if (sym === 's') return eatFork(sym, 'fals*e')
          return error(`Expected fal[s]e, got fal[${sym}]...`)
        } 
        case 'fals*e': {
          if (sym === 'e') {
            eat(sym)
            return emitValue('close false')
          }
          return error(`Expected fals[e], got fals[${sym}]...`)
        } 
        case 'n*ull': {
          if (sym === 'u') return eatFork(sym, 'nu*ll')
          return error(`Expected n[u]ll, got n[${sym}]...`)
        } 
        case 'nu*ll': {
          if (sym === 'l') return eatFork(sym, 'nul*l')
          return error(`Expected nu[l]l, got nu[${sym}]...`)
        } 
        case 'nul*l': {
          if (sym === 'l') {
            eat(sym)
            return emitValue('close null')
          }
          return error(`Expected nul[l], got nul[${sym}]...`)
        }
        default: throw Error(`Invalid parser state: ${dumpState()}`)
      }
    },
    end: () => {
      if (isDone) {
        // todo: fix error msg
        throw Error(`END: Matcher already completed! ${dumpState()}`)
      }
      isDone = true

      switch (choiceId) {
        case 'initial': {
          // todo? or push event, then call next.end() w/o args
          return next.end({
            id: 'end',
          })
        }
        default: {
          // n_structure_unclosed_array.json
          if (['exp+-0-9', '1-9*', '1-90-9*', '0-9.0-9*', '0*'].includes(choiceId)) {
            if (parents[parents.length - 1] === 'top') {
              // eatemitvalue would not work here
              emitValue('close number')
              return next.end({
                id: 'end',
              })
            }
            return error(`todo: invalid end state ${dumpState()}`)
          }

          // todo: case 'value*') return error('Unclosed array')
          // todo: case '*key') return error('Unclosed object')
          
          // todo: fix msg
          return error(`todo: invalid end state ${dumpState()}`)
        }
      }
    },
  }

  return self
}