import {
  OutputSchema as RepoEvent,
  isCommit,
  isHandle,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { AtUri } from '@atproto/syntax'
import { Database } from './db'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  private readonly targetDids: string[] = [
  ]

  constructor(db: Database, service: string, targetDids?: string[]) {
    super(db, service)
    if (targetDids) {
      this.targetDids.push(...targetDids)
    }
    console.log(`[FirehoseSubscription] initialized, targetDids: ${this.targetDids.length}`)
    if (this.targetDids.length > 0) {
      console.log(`[FirehoseSubscription] targetDids: ${this.targetDids.join(', ')}`)
    } else {
      console.log(`[FirehoseSubscription] no specific targetDids, will process all nodes`)
    }
  }



  async handleEvent(evt: RepoEvent) {

    if (!isCommit(evt)) {
      return
    }

    const ops = await getOpsByType(evt)
    

      // check if from target node
    const isFromTargetNode = this.targetDids.length === 0 || this.targetDids.includes(evt.repo)
    
    if (isFromTargetNode) {
      console.log(`[FirehoseSubscription] ✅ posts from target node: ${evt.repo}`)
       for (const post of ops.posts.creates) {
         console.log(`[FirehoseSubscription] new post details - author: ${post.author}, URI: ${post.uri}`)
         console.log(`[FirehoseSubscription] post content: ${post.record.text}`)
       }
    }


    const postsToDelete = ops.posts.deletes.map((del) => del.uri)

    const postsToCreate = ops.posts.creates
      .filter((create) => {

        const isFromTarget = this.targetDids.length === 0 || this.targetDids.includes(create.author)
        return isFromTarget
      })
      .map((create) => {
        // map posts to a db row
        console.log(`[FirehoseSubscription] prepare to store post to database: ${create.uri}`)
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
        }
      })


    if (isFromTargetNode && postsToDelete.length > 0) {
      console.log(`[FirehoseSubscription] execute delete operation, delete ${postsToDelete.length} posts`)
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    
    if (isFromTargetNode && postsToCreate.length > 0) {
      console.log(`[FirehoseSubscription] execute insert operation, insert ${postsToCreate.length} posts`)
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
      console.log(`[FirehoseSubscription] insert operation completed`)
    }
    
  }
}
