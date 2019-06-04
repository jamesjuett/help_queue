    echo "CREATE USER 'queue'@'localhost' IDENTIFIED BY 'devpass'" | mysql -uroot -proot
    echo "CREATE DATABASE queue" | mysql -uroot -proot
    echo "GRANT SELECT, INSERT, UPDATE, DELETE ON queue.* TO 'queue'@'localhost'" | mysql -uroot -proot

    mysql -uroot -proot queue < /var/www/queue_init.sql
    mysql -uroot -proot queue < /var/www/queue_update.sql
    