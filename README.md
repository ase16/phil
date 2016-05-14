# phil
Phil is the autoscaler for the will-nodes.
It scales the number of will-nodes depending on the average load.
The load of a will node is calculated by the number of tweets that should be analyzed next,
divided by maximum number of tweets that can be analyzed by a will node at once.
This maximum number is given by the nature of the datastore
that only allows to perform (delete-)batch operations on maximum 500 entities.
