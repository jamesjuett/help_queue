    echo "CREATE USER 'queue'@'localhost' IDENTIFIED BY 'devpass'" | mysql -uroot -proot
    echo "CREATE DATABASE queue" | mysql -uroot -proot
    echo "GRANT ALL ON queue.* TO 'queue'@'localhost'" | mysql -uroot -proot

    mysql -uroot -proot queue < /var/www/queue_init.sql

