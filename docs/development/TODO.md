# TODO
- Introduce Async operation for stuff like tag suggestions, etc
- [ ] **Adaptive Semantic Learning**
    - [ ] Update `user_tags` schema (add `context_embedding`, `usage_count`, `last_learned_at`)
    - [ ] Implement `reinforceTag` in `TagService` (Centroid-based Moving Average)
    - [ ] Update `TagSuggestionService` to use Hybrid Search (Global vs. User Context)
    - [ ] Integrate "Passive Gap Filling" trigger in Content Tagging flow